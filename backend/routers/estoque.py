from fastapi import APIRouter, Query
from typing import Literal
import pandas as pd
import config

router = APIRouter(prefix="/api/estoque", tags=["Farmácia / Almoxarifado"])


def _carregar() -> pd.DataFrame:
    df = pd.read_csv(config.DATA_DIR / "estoque_medicamentos.csv")
    df["quantidade_atual"]  = df["quantidade_atual"].astype(int)
    df["quantidade_minima"] = df["quantidade_minima"].astype(int)
    return df


@router.get("/")
def listar(
    status: Literal["todos", "adequado", "baixo", "critico", "esgotado"] = "todos",
    categoria: str = Query(None),
):
    """Lista completa do estoque com filtros por status e categoria."""
    df = _carregar()
    if status != "todos":
        df = df[df["status_estoque"] == status]
    if categoria:
        df = df[df["categoria"].str.lower() == categoria.lower()]
    return df.sort_values(["status_estoque", "nome"]).to_dict("records")


@router.get("/resumo")
def resumo():
    """Totais por status de estoque."""
    df    = _carregar()
    total = len(df)
    contagens = df["status_estoque"].value_counts().to_dict()
    categorias = sorted(df["categoria"].unique().tolist())
    return {
        "total_itens":  total,
        "esgotados":    contagens.get("esgotado", 0),
        "criticos":     contagens.get("critico",  0),
        "baixos":       contagens.get("baixo",    0),
        "adequados":    contagens.get("adequado", 0),
        "categorias":   categorias,
    }


@router.get("/alertas")
def alertas():
    """Insumos esgotados ou em nível crítico."""
    df = _carregar()
    df_alerta = df[df["status_estoque"].isin(["esgotado", "critico"])].copy()
    df_alerta = df_alerta.sort_values(
        ["status_estoque", "percentual_disponibilidade"]
    )
    return df_alerta.to_dict("records")
