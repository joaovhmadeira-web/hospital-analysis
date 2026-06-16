from fastapi import APIRouter, HTTPException, Query
from typing import Literal
import pandas as pd
import config
from database import engine

router = APIRouter(prefix="/api/indicadores", tags=["Indicadores"])


def _ultima_data(tabela: str, col: str) -> str:
    r = pd.read_sql(f"SELECT MAX(DATE({col})) AS dt FROM {tabela}", engine)
    return str(r["dt"].iloc[0])


@router.get("/resumo")
def resumo():
    """KPIs principais do painel: leitos, internações e fila do PA."""
    # Leitos por tipo
    df_leitos = pd.read_sql(
        """
        SELECT tl.nome AS tipo,
               COUNT(*) AS total,
               SUM(status = 'disponivel') AS disponiveis,
               SUM(status = 'ocupado')    AS ocupados,
               SUM(status = 'manutencao') AS manutencao,
               ROUND(SUM(status='ocupado')/COUNT(*)*100,1) AS taxa_ocupacao_pct
        FROM leitos l
        JOIN tipos_leito tl ON l.tipo_id = tl.id
        GROUP BY tl.id, tl.nome
        ORDER BY tl.id
        """,
        engine,
    ).fillna(0)

    # Internações ativas
    df_int = pd.read_sql(
        "SELECT COUNT(*) AS total FROM internacoes WHERE status = 'ativa'", engine
    )

    # Fila do PA — usa a data mais recente disponível
    data_pa = _ultima_data("fila_espera", "data_chegada")
    df_fila = pd.read_sql(
        f"""
        SELECT
            COUNT(*) AS total_dia,
            SUM(status IN ('aguardando','em_atendimento')) AS aguardando,
            SUM(status = 'desistiu')  AS desistencias,
            ROUND(AVG(CASE WHEN data_atendimento IS NOT NULL
                THEN TIMESTAMPDIFF(MINUTE, data_chegada, data_atendimento)
                ELSE TIMESTAMPDIFF(MINUTE, data_chegada, NOW()) END), 0
            ) AS tempo_medio_espera_min
        FROM fila_espera
        WHERE DATE(data_chegada) = '{data_pa}'
          AND status != 'desistiu'
        """,
        engine,
    ).fillna(0)

    return {
        "leitos":          df_leitos.to_dict("records"),
        "internacoes_ativas": int(df_int["total"].iloc[0]),
        "fila_pa":         {k: (int(v) if k != "tempo_medio_espera_min" else float(v))
                            for k, v in df_fila.iloc[0].items()},
        "data_referencia": data_pa,
    }


@router.get("/historico")
def historico(dias: int = Query(30, ge=7, le=365)):
    """Série histórica de indicadores diários (fonte: CSV)."""
    df = pd.read_csv(config.DATA_DIR / "historico_indicadores.csv")
    df["data"] = pd.to_datetime(df["data"])
    df = df.sort_values("data").tail(dias)
    df["data"] = df["data"].dt.strftime("%d/%m")
    return df.to_dict("records")


@router.get("/enfermidades")
def enfermidades(
    periodo: Literal["dia", "semana", "mes", "ano"] = "semana",
    limite: int = Query(10, ge=5, le=25),
):
    """Principais CIDs registrados nas internações por período."""
    intervalos = {"dia": "1 DAY", "semana": "7 DAY", "mes": "30 DAY", "ano": "365 DAY"}
    intervalo  = intervalos[periodo]

    df = pd.read_sql(
        f"""
        SELECT d.cid_codigo,
               d.descricao,
               d.categoria,
               COUNT(*) AS total_internacoes
        FROM internacoes i
        JOIN diagnosticos d ON i.diagnostico_principal_id = d.id
        WHERE i.data_entrada >= NOW() - INTERVAL {intervalo}
        GROUP BY d.id, d.cid_codigo, d.descricao, d.categoria
        ORDER BY total_internacoes DESC
        LIMIT {limite}
        """,
        engine,
    )
    return df.to_dict("records")


@router.get("/distribuicao-pacientes")
def distribuicao_pacientes():
    """Perfil epidemiológico mensal: faixa etária × sexo (fonte: CSV)."""
    df = pd.read_csv(config.DATA_DIR / "distribuicao_pacientes.csv")
    # Agrupa os últimos 12 meses
    df["ano_mes"] = df["ano"].astype(str) + "-" + df["mes"].astype(str).str.zfill(2)
    recentes = df.sort_values("ano_mes").tail(12 * 12)  # 12 meses × 12 linhas/mês

    pivot = (
        recentes.groupby(["faixa_etaria", "sexo"])["total_atendimentos"]
        .sum()
        .unstack(fill_value=0)
        .reset_index()
    )
    pivot.columns.name = None
    return pivot.rename(columns={"M": "Masculino", "F": "Feminino"}).to_dict("records")
