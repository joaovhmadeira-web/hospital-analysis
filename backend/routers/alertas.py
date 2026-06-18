import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import text
import alertas_engine
import config
from database import engine

router = APIRouter(tags=["Alertas Operacionais"])


# ──────────────────────────────────────────────────────────────────────────────
# Persistência de alertas dispensados (global, sobrevive a reinício do backend)
# ──────────────────────────────────────────────────────────────────────────────
def _garantir_tabela():
    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS alertas_dispensados (
                id_alerta VARCHAR(80) PRIMARY KEY,
                dispensado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        ))


_garantir_tabela()


def _aplicar_dispensados(alertas: list[dict]) -> list[dict]:
    """
    Remove da lista os alertas dispensados pelo operador.
    Purga dispensas cujo alerta não está mais ativo: assim, se a condição
    crítica resolver e voltar a disparar, o alerta reaparece.
    """
    ativos = {a["id"] for a in alertas}
    with engine.begin() as conn:
        if ativos:
            conn.execute(
                text("DELETE FROM alertas_dispensados WHERE NOT (id_alerta = ANY(:ids))"),
                {"ids": list(ativos)},
            )
        else:
            conn.execute(text("DELETE FROM alertas_dispensados"))

        dispensados = {
            row[0] for row in conn.execute(
                text("SELECT id_alerta FROM alertas_dispensados")
            ).fetchall()
        }

    return [a for a in alertas if a["id"] not in dispensados]


def _alertas_visiveis() -> list[dict]:
    return _aplicar_dispensados(alertas_engine.calcular_alertas())


# ──────────────────────────────────────────────────────────────────────────────
# WebSocket
# ──────────────────────────────────────────────────────────────────────────────
class GerenciadorConexoes:
    def __init__(self):
        self._conexoes: list[WebSocket] = []

    async def conectar(self, ws: WebSocket):
        await ws.accept()
        self._conexoes.append(ws)

    def desconectar(self, ws: WebSocket):
        if ws in self._conexoes:
            self._conexoes.remove(ws)

    async def broadcast(self, payload: dict):
        mortos = []
        for ws in self._conexoes:
            try:
                await ws.send_json(payload)
            except Exception:
                mortos.append(ws)
        for ws in mortos:
            self.desconectar(ws)


gerenciador = GerenciadorConexoes()


# ──────────────────────────────────────────────────────────────────────────────
# Endpoints REST
# ──────────────────────────────────────────────────────────────────────────────
@router.get("/api/alertas")
def listar_alertas():
    """Alertas operacionais ativos (endpoint REST para polling)."""
    return {"alertas": _alertas_visiveis()}


@router.post("/api/alertas/{alerta_id}/dispensar")
def dispensar_alerta(alerta_id: str):
    """
    Dispensa um alerta pelo id — vale para qualquer severidade, inclusive crítico.
    Persiste globalmente; reaparece se a condição resolver e disparar novamente.
    """
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO alertas_dispensados (id_alerta)
                VALUES (:id)
                ON CONFLICT (id_alerta) DO NOTHING
                """
            ),
            {"id": alerta_id},
        )
    return {"status": "sucesso", "dispensado": alerta_id}


@router.delete("/api/alertas/dispensados")
def limpar_dispensados():
    """Reexibe todos os alertas dispensados (limpa a lista de dispensas)."""
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM alertas_dispensados"))
    return {"status": "sucesso"}


@router.websocket("/ws/alertas")
async def websocket_alertas(websocket: WebSocket):
    """
    WebSocket que envia alertas operacionais a cada ALERT_INTERVAL_SEC segundos.
    O cliente reconecta automaticamente em caso de queda.
    """
    await gerenciador.conectar(websocket)
    try:
        while True:
            await websocket.send_json({"alertas": _alertas_visiveis()})
            await asyncio.sleep(config.ALERT_INTERVAL_SEC)
    except WebSocketDisconnect:
        gerenciador.desconectar(websocket)
    except Exception:
        gerenciador.desconectar(websocket)
