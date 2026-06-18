from fastapi import APIRouter
import pandas as pd
from database import engine

router = APIRouter(prefix="/api/profissionais", tags=["Escala de Profissionais"])

LABEL_TIPO = {
    "medico":              "Médico(a)",
    "enfermeiro":          "Enfermeiro(a)",
    "tecnico_enfermagem":  "Técnico(a) de Enfermagem",
    "fisioterapeuta":      "Fisioterapeuta",
    "outro":               "Outro",
}


def _ultima_data_plantao() -> str:
    r = pd.read_sql("SELECT MAX(data) AS dt FROM plantoes", engine)
    return str(r["dt"].iloc[0])


@router.get("/resumo")
def resumo():
    """Quadro de profissionais por tipo e especialidade."""
    df_tipo = pd.read_sql(
        """
        SELECT tipo, COUNT(*) AS total
        FROM profissionais
        WHERE ativo = TRUE
        GROUP BY tipo
        ORDER BY total DESC
        """,
        engine,
    )
    df_tipo["label"] = df_tipo["tipo"].map(LABEL_TIPO)

    df_esp = pd.read_sql(
        """
        SELECT e.nome AS especialidade, COUNT(*) AS medicos
        FROM profissionais p
        JOIN especialidades e ON p.especialidade_id = e.id
        WHERE p.tipo = 'medico' AND p.ativo = TRUE
        GROUP BY e.id, e.nome
        ORDER BY medicos DESC
        """,
        engine,
    )

    return {
        "por_tipo":        df_tipo.to_dict("records"),
        "medicos_por_especialidade": df_esp.to_dict("records"),
    }


@router.get("/escala")
def escala():
    """Cobertura de escala por turno e setor na data mais recente."""
    data = _ultima_data_plantao()
    df = pd.read_sql(
        f"""
        SELECT p.turno,
               s.nome AS setor,
               COUNT(DISTINCT p.profissional_id) AS profissionais,
               SUM(CASE WHEN pro.tipo = 'medico' THEN 1 ELSE 0 END)             AS medicos,
               SUM(CASE WHEN pro.tipo = 'enfermeiro' THEN 1 ELSE 0 END)          AS enfermeiros,
               SUM(CASE WHEN pro.tipo = 'tecnico_enfermagem' THEN 1 ELSE 0 END)  AS tecnicos
        FROM plantoes p
        JOIN setores s       ON p.setor_id = s.id
        JOIN profissionais pro ON p.profissional_id = pro.id
        WHERE p.data = '{data}'
        GROUP BY p.turno, s.id, s.nome
        ORDER BY CASE p.turno WHEN 'manha' THEN 1 WHEN 'tarde' THEN 2 WHEN 'noite' THEN 3 END, s.nome
        """,
        engine,
    ).fillna(0)

    turnos = {"manha": "Manhã (06h–14h)", "tarde": "Tarde (14h–22h)", "noite": "Noite (22h–06h)"}
    df["turno_label"] = df["turno"].map(turnos)
    return {
        "data_referencia": data,
        "escala": df.to_dict("records"),
    }


@router.get("/de-plantao-agora")
def de_plantao_agora():
    """Profissionais escalados no turno atual."""
    from datetime import datetime
    hora = datetime.now().hour
    if 6 <= hora < 14:
        turno = "manha"
    elif 14 <= hora < 22:
        turno = "tarde"
    else:
        turno = "noite"

    data = _ultima_data_plantao()
    df = pd.read_sql(
        f"""
        SELECT pro.nome,
               pro.tipo,
               pro.registro,
               COALESCE(e.nome, '—') AS especialidade,
               s.nome AS setor,
               p.inicio, p.fim
        FROM plantoes p
        JOIN profissionais pro ON p.profissional_id = pro.id
        JOIN setores s         ON p.setor_id = s.id
        LEFT JOIN especialidades e ON pro.especialidade_id = e.id
        WHERE p.data = '{data}' AND p.turno = '{turno}'
        ORDER BY s.nome, pro.tipo, pro.nome
        """,
        engine,
    )
    df["tipo_label"] = df["tipo"].map({
        "medico": "Médico(a)", "enfermeiro": "Enfermeiro(a)",
        "tecnico_enfermagem": "Técnico(a) Enf.", "fisioterapeuta": "Fisioterapeuta",
        "outro": "Outro",
    })
    return {
        "turno_atual": turno,
        "data_referencia": data,
        "profissionais": df.to_dict("records"),
    }
