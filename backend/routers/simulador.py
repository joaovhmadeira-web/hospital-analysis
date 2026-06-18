from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
import pandas as pd
import numpy as np
import math
from datetime import datetime, date, timedelta
from sqlalchemy import text
import config
from database import engine

router = APIRouter(prefix="/api/simulador", tags=["Simulador & Controle"])


def _sanitize_df(df: pd.DataFrame) -> list[dict]:
    """Convert a DataFrame to a list of dicts with NaN/NaT replaced by None for JSON serialization."""
    # Convert datetime columns to ISO format strings
    for col in df.select_dtypes(include=["datetime64[ns]", "datetimetz"]).columns:
        df[col] = df[col].dt.strftime("%Y-%m-%dT%H:%M:%S").where(df[col].notna(), None)
    # Replace NaN/NaT with None
    df = df.where(pd.notnull(df), None)
    records = df.to_dict("records")
    # Extra safety: replace any remaining float nan/inf
    for row in records:
        for k, v in row.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                row[k] = None
    return records

# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class PacienteSchema(BaseModel):
    nome: str
    data_nascimento: date
    sexo: str = Field(..., description="M ou F")
    cpf: str
    cidade: str = "Não informado"
    estado: str = "XX"

class ProfissionalSchema(BaseModel):
    nome: str
    registro: str
    tipo: str = Field(..., description="medico, enfermeiro, tecnico_enfermagem, fisioterapeuta, outro")
    especialidade_id: Optional[int] = None
    setor_id: Optional[int] = None

class LeitoSchema(BaseModel):
    numero: str
    tipo_id: int
    setor_id: int
    status: str = "disponivel"

class PlantaoSchema(BaseModel):
    profissional_id: int
    data: date
    turno: str = Field(..., description="manha, tarde ou noite")
    setor_id: int

class FilaSchema(BaseModel):
    paciente_id: Optional[int] = None
    nome_paciente: str
    prioridade: str = Field(..., description="vermelho, laranja, amarelo, verde, azul")
    queixa_principal: str
    data_chegada: Optional[datetime] = None

class AtenderFilaSchema(BaseModel):
    fila_id: int
    status: str = Field(..., description="em_atendimento, atendido, desistiu, encaminhado")
    data_atendimento: Optional[datetime] = None

class InternacaoSchema(BaseModel):
    paciente_id: int
    leito_id: int
    diagnostico_principal_id: int
    medico_responsavel_id: int
    data_entrada: Optional[datetime] = None

class AltaInternacaoSchema(BaseModel):
    internacao_id: int
    status: str = Field(..., description="alta, obito, transferencia")
    data_alta: Optional[datetime] = None

class IndicadorRow(BaseModel):
    data: str
    internacoes_ativas: int
    leitos_disponiveis_total: int
    leitos_disponiveis_enfermaria: int
    leitos_disponiveis_quarto: int
    leitos_disponiveis_cti: int
    taxa_ocupacao_pct: float
    taxa_ocupacao_cti_pct: float
    fila_espera_media_dia: int
    fila_espera_pico: int
    pacientes_atendidos_pa: int
    tempo_espera_medio_min: int
    altas_dia: int
    obitos_dia: int
    transferencias_dia: int
    novos_internados_dia: int
    cirurgias_realizadas: int


# ── GET Lookups ──────────────────────────────────────────────────────────────

@router.get("/lookups")
def get_lookups():
    """Retorna todas as tabelas de apoio necessárias para preencher os formulários do simulador."""
    try:
        pacientes = _sanitize_df(pd.read_sql("SELECT id, nome, cpf FROM pacientes ORDER BY nome", engine))
        leitos_disp = _sanitize_df(pd.read_sql("SELECT id, numero, status, setor_id, tipo_id FROM leitos ORDER BY numero", engine))
        profissionais = _sanitize_df(pd.read_sql("SELECT id, nome, registro, tipo, setor_id FROM profissionais WHERE ativo = TRUE ORDER BY nome", engine))
        setores = _sanitize_df(pd.read_sql("SELECT id, nome, andar, ala FROM setores ORDER BY nome", engine))
        especialidades = _sanitize_df(pd.read_sql("SELECT id, nome FROM especialidades ORDER BY nome", engine))
        diagnosticos = _sanitize_df(pd.read_sql("SELECT id, cid_codigo, descricao, categoria FROM diagnosticos ORDER BY cid_codigo", engine))
        tipos_leito = _sanitize_df(pd.read_sql("SELECT id, nome FROM tipos_leito ORDER BY nome", engine))

        # Fila de espera ativa para a tela de monitoramento/atendimento no simulador
        fila_ativa = _sanitize_df(pd.read_sql(
            """
            SELECT id, paciente_id, nome_paciente, data_chegada, prioridade, queixa_principal, status
            FROM fila_espera
            WHERE status IN ('aguardando', 'em_atendimento')
            ORDER BY
              CASE prioridade
                WHEN 'vermelho' THEN 1
                WHEN 'laranja' THEN 2
                WHEN 'amarelo' THEN 3
                WHEN 'verde' THEN 4
                WHEN 'azul' THEN 5
              END, data_chegada
            """,
            engine
        ))

        # Internações ativas para a aba de alta no simulador
        internacoes_ativas = _sanitize_df(pd.read_sql(
            """
            SELECT i.id, p.nome AS paciente_nome, l.numero AS leito_numero, i.leito_id,
                   d.cid_codigo AS cid, d.descricao AS diagnostico, i.data_entrada,
                   pro.nome AS medico_nome
            FROM internacoes i
            JOIN pacientes p ON i.paciente_id = p.id
            JOIN leitos l ON i.leito_id = l.id
            JOIN diagnosticos d ON i.diagnostico_principal_id = d.id
            JOIN profissionais pro ON i.medico_responsavel_id = pro.id
            WHERE i.status = 'ativa'
            ORDER BY i.data_entrada DESC
            """,
            engine
        ))

        return {
            "pacientes": pacientes,
            "leitos": leitos_disp,
            "profissionais": profissionais,
            "setores": setores,
            "especialidades": especialidades,
            "diagnosticos": diagnosticos,
            "tipos_leito": tipos_leito,
            "fila_ativa": fila_ativa,
            "internacoes_ativas": internacoes_ativas
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar lookups: {str(e)}")


# ── POST Simulação Endpoints ──────────────────────────────────────────────────

@router.post("/paciente")
def criar_paciente(payload: PacienteSchema):
    """Simula a criação de um novo paciente fictício."""
    try:
        query = text(
            """
            INSERT INTO pacientes (nome, data_nascimento, sexo, cpf, cidade, estado)
            VALUES (:nome, :data_nascimento, :sexo, :cpf, :cidade, :estado)
            RETURNING id
            """
        )
        with engine.begin() as conn:
            result = conn.execute(
                query,
                {
                    "nome": payload.nome,
                    "data_nascimento": payload.data_nascimento,
                    "sexo": payload.sexo,
                    "cpf": payload.cpf,
                    "cidade": payload.cidade,
                    "estado": payload.estado
                }
            )
            new_id = result.fetchone()[0]
        return {"status": "sucesso", "mensagem": "Paciente cadastrado com sucesso!", "id": new_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao cadastrar paciente (verifique se o CPF já existe): {str(e)}")


@router.post("/profissional")
def criar_profissional(payload: ProfissionalSchema):
    """Cadastra um novo profissional de saúde fictício."""
    try:
        query = text(
            """
            INSERT INTO profissionais (nome, registro, tipo, especialidade_id, setor_id, ativo)
            VALUES (:nome, :registro, :tipo, :especialidade_id, :setor_id, TRUE)
            RETURNING id
            """
        )
        with engine.begin() as conn:
            result = conn.execute(
                query,
                {
                    "nome": payload.nome,
                    "registro": payload.registro,
                    "tipo": payload.tipo,
                    "especialidade_id": payload.especialidade_id,
                    "setor_id": payload.setor_id
                }
            )
            new_id = result.fetchone()[0]
        return {"status": "sucesso", "mensagem": "Profissional cadastrado!", "id": new_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao cadastrar profissional: {str(e)}")


@router.post("/leito")
def criar_leito(payload: LeitoSchema):
    """Cria um novo leito no censo hospitalar."""
    try:
        query = text(
            """
            INSERT INTO leitos (numero, tipo_id, setor_id, status)
            VALUES (:numero, :tipo_id, :setor_id, :status)
            RETURNING id
            """
        )
        with engine.begin() as conn:
            result = conn.execute(
                query,
                {
                    "numero": payload.numero,
                    "tipo_id": payload.tipo_id,
                    "setor_id": payload.setor_id,
                    "status": payload.status
                }
            )
            new_id = result.fetchone()[0]
        return {"status": "sucesso", "mensagem": "Leito criado!", "id": new_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao criar leito: {str(e)}")


@router.post("/plantao")
def criar_plantao(payload: PlantaoSchema):
    """Escala um profissional para cobrir um plantão de 8 horas."""
    try:
        # Calcular início e fim
        TURNO_HORARIO = {
            "manha": (6, 14),
            "tarde": (14, 22),
            "noite": (22, 30) # 30 = 06:00 do dia seguinte
        }
        if payload.turno not in TURNO_HORARIO:
            raise ValueError("Turno inválido. Escolha manha, tarde ou noite.")

        h_ini, h_fim = TURNO_HORARIO[payload.turno]
        dt_inicio = datetime(payload.data.year, payload.data.month, payload.data.day, h_ini, 0, 0)
        dt_fim = dt_inicio + timedelta(hours=8)

        query = text(
            """
            INSERT INTO plantoes (profissional_id, data, turno, inicio, fim, setor_id)
            VALUES (:profissional_id, :data, :turno, :inicio, :fim, :setor_id)
            RETURNING id
            """
        )
        with engine.begin() as conn:
            result = conn.execute(
                query,
                {
                    "profissional_id": payload.profissional_id,
                    "data": payload.data,
                    "turno": payload.turno,
                    "inicio": dt_inicio,
                    "fim": dt_fim,
                    "setor_id": payload.setor_id
                }
            )
            new_id = result.fetchone()[0]
        return {"status": "sucesso", "mensagem": "Plantão escalado!", "id": new_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao criar plantão: {str(e)}")


@router.post("/fila")
def entrar_na_fila(payload: FilaSchema):
    """Simula a entrada de um paciente no Pronto Atendimento com a classificação de Manchester."""
    try:
        chegada = payload.data_chegada if payload.data_chegada else datetime.now()
        query = text(
            """
            INSERT INTO fila_espera (paciente_id, nome_paciente, data_chegada, prioridade, queixa_principal, status)
            VALUES (:paciente_id, :nome_paciente, :data_chegada, :prioridade, :queixa_principal, 'aguardando')
            RETURNING id
            """
        )
        with engine.begin() as conn:
            result = conn.execute(
                query,
                {
                    "paciente_id": payload.paciente_id,
                    "nome_paciente": payload.nome_paciente,
                    "data_chegada": chegada,
                    "prioridade": payload.prioridade,
                    "queixa_principal": payload.queixa_principal
                }
            )
            new_id = result.fetchone()[0]
        return {"status": "sucesso", "mensagem": "Paciente triado e inserido na fila!", "id": new_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao registrar entrada na fila: {str(e)}")


@router.post("/atender-fila")
def atender_fila(payload: AtenderFilaSchema):
    """Atualiza o status de atendimento da fila (iniciar atendimento, finalizar atendimento ou desistência)."""
    try:
        atendimento = payload.data_atendimento if payload.data_atendimento else datetime.now()
        query = text(
            """
            UPDATE fila_espera
            SET status = :status,
                data_atendimento = :data_atendimento
            WHERE id = :fila_id
            """
        )
        with engine.begin() as conn:
            conn.execute(
                query,
                {
                    "status": payload.status,
                    "data_atendimento": None if payload.status == "aguardando" else (atendimento if payload.status != "desistiu" else None),
                    "fila_id": payload.fila_id
                }
            )
        return {"status": "sucesso", "mensagem": f"Status da fila atualizado para '{payload.status}'!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao atualizar status da fila: {str(e)}")


@router.post("/internacao")
def internar_paciente(payload: InternacaoSchema):
    """Interna um paciente em um leito específico. Altera o leito para 'ocupado' transacionalmente."""
    try:
        entrada = payload.data_entrada if payload.data_entrada else datetime.now()
        
        with engine.begin() as conn:
            # 1. Verificar se o leito está livre
            leito_stat = conn.execute(
                text("SELECT status FROM leitos WHERE id = :leito_id"),
                {"leito_id": payload.leito_id}
            ).fetchone()

            if not leito_stat:
                raise ValueError("Leito não encontrado.")
            if leito_stat[0] != "disponivel":
                raise ValueError(f"O leito selecionado está com status '{leito_stat[0]}' e não pode ser ocupado.")

            # 2. Inserir a internação
            insert_query = text(
                """
                INSERT INTO internacoes (paciente_id, leito_id, data_entrada, status, diagnostico_principal_id, medico_responsavel_id)
                VALUES (:paciente_id, :leito_id, :data_entrada, 'ativa', :diagnostico_principal_id, :medico_responsavel_id)
                RETURNING id
                """
            )
            result = conn.execute(
                insert_query,
                {
                    "paciente_id": payload.paciente_id,
                    "leito_id": payload.leito_id,
                    "data_entrada": entrada,
                    "diagnostico_principal_id": payload.diagnostico_principal_id,
                    "medico_responsavel_id": payload.medico_responsavel_id
                }
            )
            new_id = result.fetchone()[0]

            # 3. Atualizar o leito para 'ocupado'
            conn.execute(
                text("UPDATE leitos SET status = 'ocupado' WHERE id = :leito_id"),
                {"leito_id": payload.leito_id}
            )

        return {"status": "sucesso", "mensagem": "Paciente internado com sucesso!", "internacao_id": new_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao criar internação: {str(e)}")


@router.post("/alta-internacao")
def alta_internacao(payload: AltaInternacaoSchema):
    """Registra alta/óbito/transferência de um paciente internado e libera o leito transacionalmente."""
    try:
        alta = payload.data_alta if payload.data_alta else datetime.now()

        with engine.begin() as conn:
            # 1. Buscar leito_id e verificar status da internação
            internacao = conn.execute(
                text("SELECT leito_id, status FROM internacoes WHERE id = :internacao_id"),
                {"internacao_id": payload.internacao_id}
            ).fetchone()

            if not internacao:
                raise ValueError("Internação não encontrada.")
            if internacao[1] != "ativa":
                raise ValueError("Esta internação já foi encerrada anteriormente.")

            leito_id = internacao[0]

            # 2. Atualizar internação
            update_query = text(
                """
                UPDATE internacoes
                SET status = :status,
                    data_alta = :data_alta
                WHERE id = :internacao_id
                """
            )
            conn.execute(
                update_query,
                {
                    "status": payload.status,
                    "data_alta": alta,
                    "internacao_id": payload.internacao_id
                }
            )

            # 3. Liberar o leito
            conn.execute(
                text("UPDATE leitos SET status = 'disponivel' WHERE id = :leito_id"),
                {"leito_id": leito_id}
            )

        return {"status": "sucesso", "mensagem": f"Alta registrada com status '{payload.status}' e leito liberado!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao registrar alta: {str(e)}")


# ── CSV Indicadores Projetados Endpoints ─────────────────────────────────────

@router.get("/historico-csv")
def get_historico_csv(limit: int = Query(60, ge=10, le=365)):
    """Lê os últimos N registros do arquivo de série histórica CSV para visualização e edição."""
    try:
        df = pd.read_csv(config.DATA_DIR / "historico_indicadores.csv")
        df = df.sort_values("data", ascending=True)
        # Retorna apenas as últimas linhas para evitar sobrecarregar
        df_recent = df.tail(limit)
        return df_recent.to_dict("records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao ler histórico CSV: {str(e)}")


@router.post("/salvar-historico-csv")
def salvar_historico_csv(payload: List[IndicadorRow]):
    """Sobrescreve/atualiza a série histórica de indicadores no arquivo CSV com as edições manuais."""
    try:
        # Carregar arquivo atual
        csv_path = config.DATA_DIR / "historico_indicadores.csv"
        df_atual = pd.read_csv(csv_path)

        # Converter payload recebido para DataFrame
        novos_dados = [row.model_dump() for row in payload]
        df_novos = pd.DataFrame(novos_dados)

        # Mesclar dados novos com os dados existentes no arquivo (por coluna de data)
        # O que não estiver no payload mantém os dados antigos
        df_atual = df_atual.set_index("data")
        df_novos = df_novos.set_index("data")

        # Atualizar os índices que coincidem e manter o restante
        df_atual.update(df_novos)

        # Adicionar possíveis novas datas inseridas que não existiam no arquivo
        novos_indices = df_novos.index.difference(df_atual.index)
        if not novos_indices.empty:
            df_atual = pd.concat([df_atual, df_novos.loc[novos_indices]])

        df_atual = df_atual.reset_index()
        # Garantir ordenação das datas
        df_atual["data_parsed"] = pd.to_datetime(df_atual["data"])
        df_atual = df_atual.sort_values("data_parsed").drop(columns=["data_parsed"])

        # Garantir a ordem original das colunas
        cols = [
            "data", "internacoes_ativas", "leitos_disponiveis_total", "leitos_disponiveis_enfermaria",
            "leitos_disponiveis_quarto", "leitos_disponiveis_cti", "taxa_ocupacao_pct", "taxa_ocupacao_cti_pct",
            "fila_espera_media_dia", "fila_espera_pico", "pacientes_atendidos_pa", "tempo_espera_medio_min",
            "altas_dia", "obitos_dia", "transferencias_dia", "novos_internados_dia", "cirurgias_realizadas"
        ]
        df_atual = df_atual[cols]

        # Salvar de volta para o CSV
        df_atual.to_csv(csv_path, index=False, encoding="utf-8-sig")

        return {"status": "sucesso", "mensagem": "Série histórica de indicadores atualizada no arquivo CSV!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao salvar histórico de indicadores no CSV: {str(e)}")
