import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import alertas_engine
import config

router = APIRouter(tags=["Alertas Operacionais"])


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


@router.get("/api/alertas")
def listar_alertas():
    """Alertas operacionais ativos (endpoint REST para polling)."""
    return {"alertas": alertas_engine.calcular_alertas()}


@router.websocket("/ws/alertas")
async def websocket_alertas(websocket: WebSocket):
    """
    WebSocket que envia alertas operacionais a cada ALERT_INTERVAL_SEC segundos.
    O cliente reconecta automaticamente em caso de queda.
    """
    await gerenciador.conectar(websocket)
    try:
        while True:
            payload = {
                "alertas": alertas_engine.calcular_alertas(),
            }
            await websocket.send_json(payload)
            await asyncio.sleep(config.ALERT_INTERVAL_SEC)
    except WebSocketDisconnect:
        gerenciador.desconectar(websocket)
    except Exception:
        gerenciador.desconectar(websocket)
