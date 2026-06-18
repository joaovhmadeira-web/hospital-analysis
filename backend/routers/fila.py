from fastapi import APIRouter
import pandas as pd
from database import engine

router = APIRouter(prefix="/api/fila", tags=["PA / Fila de Espera"])

ORDEM_MANCHESTER = ["vermelho", "laranja", "amarelo", "verde", "azul"]
LABELS_MANCHESTER = {
    "vermelho": "Emergência",
    "laranja":  "Muito Urgente",
    "amarelo":  "Urgente",
    "verde":    "Pouco Urgente",
    "azul":     "Não Urgente",
}


def _ultima_data_pa() -> str:
    r = pd.read_sql(
        "SELECT MAX(CAST(data_chegada AS DATE)) AS dt FROM fila_espera", engine
    )
    return str(r["dt"].iloc[0])


@router.get("/resumo")
def resumo():
    """Resumo do fluxo do PA no dia de referência."""
    data = _ultima_data_pa()
    df = pd.read_sql(
        f"""
        SELECT
            COUNT(*) AS total_registros,
            SUM(CASE WHEN status IN ('aguardando','em_atendimento') THEN 1 ELSE 0 END) AS aguardando,
            SUM(CASE WHEN status = 'atendido' THEN 1 ELSE 0 END)     AS atendidos,
            SUM(CASE WHEN status = 'encaminhado' THEN 1 ELSE 0 END)  AS encaminhados,
            SUM(CASE WHEN status = 'desistiu' THEN 1 ELSE 0 END)     AS desistencias,
            ROUND(AVG(CASE WHEN data_atendimento IS NOT NULL
                THEN EXTRACT(EPOCH FROM (data_atendimento - data_chegada)) / 60 END), 0
            ) AS tempo_medio_atendimento_min,
            MIN(CASE WHEN data_atendimento IS NOT NULL
                THEN EXTRACT(EPOCH FROM (data_atendimento - data_chegada)) / 60 END
            ) AS tempo_min_min,
            MAX(CASE WHEN data_atendimento IS NOT NULL
                THEN EXTRACT(EPOCH FROM (data_atendimento - data_chegada)) / 60 END
            ) AS tempo_max_min
        FROM fila_espera
        WHERE CAST(data_chegada AS DATE) = '{data}'
        """,
        engine,
    ).fillna(0)
    return {**df.iloc[0].to_dict(), "data_referencia": data}


@router.get("/por-prioridade")
def por_prioridade():
    """Distribuição por nível de classificação de risco (Manchester)."""
    data = _ultima_data_pa()
    df = pd.read_sql(
        f"""
        SELECT prioridade,
               COUNT(*) AS total,
               SUM(CASE WHEN status IN ('aguardando','em_atendimento') THEN 1 ELSE 0 END) AS aguardando,
               ROUND(AVG(CASE WHEN data_atendimento IS NOT NULL
                   THEN EXTRACT(EPOCH FROM (data_atendimento - data_chegada)) / 60 END), 0
               ) AS tempo_medio_min
        FROM fila_espera
        WHERE CAST(data_chegada AS DATE) = '{data}'
        GROUP BY prioridade
        """,
        engine,
    ).fillna(0)

    df["label"]     = df["prioridade"].map(LABELS_MANCHESTER)
    df["ordem"]     = df["prioridade"].map({c: i for i, c in enumerate(ORDEM_MANCHESTER)})
    df = df.sort_values("ordem").drop(columns="ordem")
    return df.to_dict("records")


@router.get("/historico")
def historico(dias: int = 30):
    """Evolução diária do fluxo do PA nos últimos N dias."""
    df = pd.read_sql(
        f"""
        SELECT CAST(data_chegada AS DATE) AS data,
               COUNT(*) AS total,
               SUM(CASE WHEN status IN ('aguardando','em_atendimento') THEN 1 ELSE 0 END) AS aguardando,
               SUM(CASE WHEN status = 'desistiu' THEN 1 ELSE 0 END) AS desistencias,
               ROUND(AVG(CASE WHEN data_atendimento IS NOT NULL
                   THEN EXTRACT(EPOCH FROM (data_atendimento - data_chegada)) / 60 END), 0
               ) AS tempo_medio_min
        FROM fila_espera
        WHERE data_chegada >= NOW() - INTERVAL '{dias} days'
        GROUP BY CAST(data_chegada AS DATE)
        ORDER BY data
        """,
        engine,
    ).fillna(0)
    df["data"] = pd.to_datetime(df["data"]).dt.strftime("%d/%m")
    return df.to_dict("records")
