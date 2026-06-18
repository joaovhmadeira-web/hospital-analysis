from fastapi import APIRouter
import pandas as pd
from database import engine

router = APIRouter(prefix="/api/leitos", tags=["Censo de Leitos"])


@router.get("/disponibilidade")
def disponibilidade():
    """Disponibilidade de leitos por tipo e setor (censo hospitalar)."""
    df = pd.read_sql(
        """
        SELECT s.nome AS setor,
               tl.nome AS tipo,
               COUNT(*) AS total,
               SUM(CASE WHEN l.status = 'disponivel' THEN 1 ELSE 0 END)  AS disponiveis,
               SUM(CASE WHEN l.status = 'ocupado' THEN 1 ELSE 0 END)     AS ocupados,
               SUM(CASE WHEN l.status = 'manutencao' THEN 1 ELSE 0 END)  AS manutencao,
               SUM(CASE WHEN l.status = 'reservado' THEN 1 ELSE 0 END)   AS reservados,
               ROUND(SUM(CASE WHEN l.status='ocupado' THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100, 1) AS taxa_ocupacao_pct
        FROM leitos l
        JOIN tipos_leito tl ON l.tipo_id = tl.id
        JOIN setores s      ON l.setor_id = s.id
        GROUP BY s.id, s.nome, tl.id, tl.nome
        ORDER BY tl.id, s.nome
        """,
        engine,
    ).fillna(0)
    return df.to_dict("records")


@router.get("/resumo-tipo")
def resumo_tipo():
    """Totais consolidados por tipo de leito."""
    df = pd.read_sql(
        """
        SELECT tl.nome AS tipo,
               COUNT(*) AS total,
               SUM(CASE WHEN l.status = 'disponivel' THEN 1 ELSE 0 END)  AS disponiveis,
               SUM(CASE WHEN l.status = 'ocupado' THEN 1 ELSE 0 END)     AS ocupados,
               SUM(CASE WHEN l.status = 'manutencao' THEN 1 ELSE 0 END)  AS manutencao,
               ROUND(SUM(CASE WHEN l.status='ocupado' THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100, 1) AS taxa_ocupacao_pct
        FROM leitos l
        JOIN tipos_leito tl ON l.tipo_id = tl.id
        GROUP BY tl.id, tl.nome
        ORDER BY tl.id
        """,
        engine,
    ).fillna(0)
    return df.to_dict("records")
