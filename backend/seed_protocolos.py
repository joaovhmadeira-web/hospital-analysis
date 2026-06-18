"""
Cria/povoa as tabelas de protocolos clínicos:
  - medicamentos          (migrado do CSV estoque_medicamentos.csv)
  - protocolos_tratamento (diagnóstico + faixa etária -> especialidade)
  - protocolo_medicamentos (medicamentos exigidos por protocolo)

Idempotente: pode rodar várias vezes. Limpa as 3 tabelas e repovoa.

Uso (a partir de backend/, com a venv ativa):
    python seed_protocolos.py
"""
from pathlib import Path
import pandas as pd
from sqlalchemy import text
import config
from database import engine

DDL_PATH = config.ROOT / "schema_protocolos.sql"
CSV_PATH = config.DATA_DIR / "estoque_medicamentos.csv"


# ──────────────────────────────────────────────────────────────────────────────
# Protocolos clínicos
# Cada entrada: (cid, idade_min, idade_max, especialidade, nome, observacao,
#                [(medicamento_id, qtd_por_internacao, frequencia), ...])
# medicamento_id == id do CSV (preservado na migração).
# ──────────────────────────────────────────────────────────────────────────────
PROTOCOLOS = [
    # ── Pneumonia (J18.9) — varia com a idade ────────────────────────────────
    ("J18.9", 0, 12, "Pediatria",
     "Pneumonia pediátrica",
     "Criança: antibioticoterapia oral/IV e suporte.",
     [(12, 2, "1x/dia"), (4, 6, "se febre"), (1, 8, "manutenção"), (67, 1, "se hipoxemia")]),
    ("J18.9", 13, 64, "Pneumologia",
     "Pneumonia adulto",
     "Adulto: ceftriaxona IV + suporte.",
     [(13, 14, "2x/dia"), (4, 8, "se febre"), (7, 5, "1x/dia"), (1, 10, "manutenção"), (67, 1, "se hipoxemia")]),
    ("J18.9", 65, 120, "Pneumologia",
     "Pneumonia idoso (alto risco)",
     "Idoso: cobertura ampliada + profilaxia de TEV.",
     [(16, 21, "3x/dia"), (13, 7, "1x/dia"), (1, 12, "manutenção"), (67, 2, "O2 prolongado"), (19, 7, "profilaxia TEV")]),

    # ── Infarto agudo do miocárdio (I21.9) ───────────────────────────────────
    ("I21.9", 0, 120, "Cardiologia",
     "IAM — síndrome coronariana aguda",
     "Analgesia, anticoagulação e betabloqueio.",
     [(6, 3, "se dor"), (18, 10, "contínuo"), (22, 4, "2x/dia"), (24, 14, "2x/dia"), (19, 7, "1x/dia")]),

    # ── Hipertensão essencial (I10) ──────────────────────────────────────────
    ("I10", 0, 120, "Cardiologia",
     "Crise/controle hipertensivo",
     "Anti-hipertensivos orais.",
     [(24, 28, "2x/dia"), (25, 14, "1x/dia"), (21, 14, "1x/dia"), (23, 14, "1x/dia")]),

    # ── Diabetes mellitus tipo 2 (E11.9) ─────────────────────────────────────
    ("E11.9", 0, 120, "Endocrinologia",
     "Descompensação diabética",
     "Insulinoterapia e controle glicêmico.",
     [(33, 2, "esquema"), (34, 2, "2x/dia"), (2, 4, "manutenção"), (32, 3, "se hipoglicemia")]),

    # ── DPOC exacerbado (J44.1) ──────────────────────────────────────────────
    ("J44.1", 0, 120, "Pneumologia",
     "DPOC exacerbação aguda",
     "Broncodilatadores, corticoide e oxigenoterapia.",
     [(48, 1, "4x/dia"), (49, 2, "nebulização"), (50, 6, "se broncoespasmo"), (36, 3, "1x/dia"), (67, 2, "O2"), (66, 1, "nebulização")]),

    # ── Doença renal crônica (N18.9) ─────────────────────────────────────────
    ("N18.9", 0, 120, "Nefrologia",
     "DRC — manejo hidroeletrolítico",
     "Diurético, correção de acidose e eletrólitos.",
     [(20, 10, "2x/dia"), (1, 6, "manutenção"), (43, 4, "se acidose"), (42, 3, "reposição")]),

    # ── Colecistite aguda (K80.1) ────────────────────────────────────────────
    ("K80.1", 0, 120, "Gastroenterologia",
     "Colecistite aguda",
     "Antibiótico, analgesia e proteção gástrica.",
     [(13, 10, "1x/dia"), (5, 6, "se dor"), (4, 8, "se dor"), (7, 5, "1x/dia"), (8, 6, "se náusea"), (1, 8, "manutenção")]),

    # ── Fratura do colo do fêmur (S72.0) ─────────────────────────────────────
    ("S72.0", 0, 120, "Ortopedia",
     "Fratura de fêmur — pré/pós-operatório",
     "Analgesia potente, profilaxia de TEV e ATB profilático.",
     [(6, 4, "se dor"), (5, 8, "horário"), (19, 10, "1x/dia"), (4, 10, "horário"), (13, 3, "profilaxia")]),

    # ── Sepse (A41.9) ────────────────────────────────────────────────────────
    ("A41.9", 0, 120, "Infectologia",
     "Sepse / choque séptico",
     "Antibiótico de amplo espectro, vasopressor e expansão volêmica.",
     [(17, 21, "3x/dia"), (15, 14, "2x/dia"), (29, 6, "contínuo"), (1, 20, "expansão"), (37, 4, "se choque")]),

    # ── Apneia do sono (G47.3) ───────────────────────────────────────────────
    ("G47.3", 0, 120, "Pneumologia",
     "Apneia obstrutiva do sono",
     "Suporte ventilatório / oxigenoterapia noturna.",
     [(67, 1, "noturno"), (66, 1, "se necessário")]),

    # ── Neoplasia de pulmão (C34.1) ──────────────────────────────────────────
    ("C34.1", 0, 120, "Oncologia",
     "Neoplasia pulmonar — suporte",
     "Controle de dor, corticoide e antiemese.",
     [(6, 6, "horário"), (35, 4, "1x/dia"), (9, 6, "se náusea"), (1, 8, "manutenção")]),

    # ── AVC isquêmico (I63.9) ────────────────────────────────────────────────
    ("I63.9", 0, 120, "Neurologia",
     "AVC isquêmico agudo",
     "Anticoagulação, controle pressórico e neuroproteção.",
     [(19, 7, "1x/dia"), (1, 8, "manutenção"), (40, 4, "profilaxia"), (24, 7, "controle PA")]),

    # ── Gastrite (K29.7) ─────────────────────────────────────────────────────
    ("K29.7", 0, 120, "Gastroenterologia",
     "Gastrite aguda",
     "Inibidor de bomba e antiemético.",
     [(7, 5, "1x/dia"), (8, 4, "se náusea"), (1, 4, "manutenção")]),

    # ── Infecção de vias aéreas superiores (J06.9) — varia com a idade ───────
    ("J06.9", 0, 12, "Pediatria",
     "IVAS pediátrica",
     "Sintomáticos e hidratação.",
     [(4, 4, "se febre"), (1, 3, "hidratação")]),
    ("J06.9", 13, 120, "Clínica Geral",
     "IVAS adulto",
     "Sintomáticos.",
     [(4, 4, "se febre"), (1, 3, "hidratação")]),

    # ── Síncope (R55) ────────────────────────────────────────────────────────
    ("R55", 0, 120, "Clínica Geral",
     "Síncope / investigação",
     "Hidratação e suporte.",
     [(1, 3, "expansão"), (31, 1, "se bradicardia")]),

    # ── Alergia / anafilaxia (T78.4) ─────────────────────────────────────────
    ("T78.4", 0, 120, "Clínica Geral",
     "Reação alérgica / anafilaxia",
     "Corticoide e adrenalina.",
     [(37, 2, "dose única"), (35, 2, "1x/dia"), (30, 1, "se anafilaxia")]),

    # ── Dor lombar (M54.5) ───────────────────────────────────────────────────
    ("M54.5", 0, 120, "Ortopedia",
     "Lombalgia aguda",
     "Analgesia e relaxante muscular.",
     [(4, 6, "horário"), (5, 4, "se dor"), (10, 2, "à noite")]),

    # ── Cefaleia (R51) ───────────────────────────────────────────────────────
    ("R51", 0, 120, "Neurologia",
     "Cefaleia — investigação",
     "Analgesia e antiemese.",
     [(4, 4, "se dor"), (8, 2, "se náusea")]),

    # ── Infecção do trato urinário (N39.0) ───────────────────────────────────
    ("N39.0", 0, 120, "Nefrologia",
     "ITU complicada",
     "Antibioticoterapia.",
     [(14, 10, "2x/dia"), (13, 7, "1x/dia"), (1, 4, "hidratação")]),

    # ── Gastroenterite (A09) — varia com a idade ─────────────────────────────
    ("A09", 0, 12, "Pediatria",
     "Gastroenterite pediátrica",
     "Reidratação e antiemese; ATB se disenteria.",
     [(1, 6, "reidratação"), (2, 3, "manutenção"), (9, 3, "se vômito")]),
    ("A09", 13, 120, "Infectologia",
     "Gastroenterite adulto",
     "Reidratação e ATB se bacteriana.",
     [(1, 6, "reidratação"), (14, 6, "2x/dia"), (9, 3, "se vômito")]),

    # ── Insuficiência cardíaca (I50.9) ───────────────────────────────────────
    ("I50.9", 0, 120, "Cardiologia",
     "Insuficiência cardíaca descompensada",
     "Diurético, IECA e profilaxia de TEV.",
     [(20, 12, "2x/dia"), (24, 14, "2x/dia"), (25, 14, "1x/dia"), (19, 7, "1x/dia")]),

    # ── Episódio depressivo (F32.9) ──────────────────────────────────────────
    ("F32.9", 0, 120, "Psiquiatria",
     "Episódio depressivo",
     "Suporte e ansiolítico se necessário.",
     [(10, 4, "à noite")]),

    # ── Desidratação (E86) ───────────────────────────────────────────────────
    ("E86", 0, 120, "Clínica Geral",
     "Depleção de volume / desidratação",
     "Reposição volêmica e eletrolítica.",
     [(1, 6, "expansão"), (3, 4, "manutenção"), (42, 2, "reposição K")]),

    # ── Doença diverticular (K57.3) ──────────────────────────────────────────
    ("K57.3", 0, 120, "Gastroenterologia",
     "Diverticulite",
     "Antibioticoterapia e analgesia.",
     [(14, 8, "2x/dia"), (13, 7, "1x/dia"), (4, 6, "se dor"), (1, 6, "manutenção")]),

    # ── Infecção viral inespecífica (B34.9) ──────────────────────────────────
    ("B34.9", 0, 120, "Clínica Geral",
     "Infecção viral inespecífica",
     "Sintomáticos e hidratação.",
     [(1, 4, "hidratação"), (4, 4, "se febre")]),
]


def _migrar_medicamentos(conn):
    df = pd.read_csv(CSV_PATH)
    insert = text(
        """
        INSERT INTO medicamentos
            (id, nome, categoria, unidade, quantidade_atual, quantidade_minima,
             percentual_disponibilidade, status_estoque, fornecedor, validade,
             localizacao_almoxarifado)
        VALUES
            (:id, :nome, :categoria, :unidade, :quantidade_atual, :quantidade_minima,
             :percentual_disponibilidade, :status_estoque, :fornecedor, :validade,
             :localizacao_almoxarifado)
        """
    )
    for _, r in df.iterrows():
        conn.execute(insert, {
            "id": int(r["id"]),
            "nome": r["nome"],
            "categoria": r["categoria"],
            "unidade": r["unidade"],
            "quantidade_atual": int(r["quantidade_atual"]),
            "quantidade_minima": int(r["quantidade_minima"]),
            "percentual_disponibilidade": float(r["percentual_disponibilidade"]),
            "status_estoque": r["status_estoque"],
            "fornecedor": r["fornecedor"],
            "validade": r["validade"],
            "localizacao_almoxarifado": r["localizacao_almoxarifado"],
        })
    # Reposiciona a sequence para novos inserts via simulador/CRUD
    conn.execute(text(
        "SELECT setval('medicamentos_id_seq', (SELECT MAX(id) FROM medicamentos))"
    ))
    return len(df)


def _povoar_protocolos(conn):
    # mapas de apoio
    diag = {row[0]: row[1] for row in conn.execute(
        text("SELECT cid_codigo, id FROM diagnosticos")).fetchall()}
    esp = {row[0]: row[1] for row in conn.execute(
        text("SELECT nome, id FROM especialidades")).fetchall()}

    ins_prot = text(
        """
        INSERT INTO protocolos_tratamento
            (diagnostico_id, idade_min, idade_max, especialidade_id, nome, observacao)
        VALUES (:diagnostico_id, :idade_min, :idade_max, :especialidade_id, :nome, :observacao)
        RETURNING id
        """
    )
    ins_item = text(
        """
        INSERT INTO protocolo_medicamentos
            (protocolo_id, medicamento_id, quantidade_por_internacao, frequencia)
        VALUES (:protocolo_id, :medicamento_id, :quantidade_por_internacao, :frequencia)
        """
    )

    n_prot = n_item = 0
    for cid, idade_min, idade_max, especialidade, nome, obs, meds in PROTOCOLOS:
        if cid not in diag:
            raise ValueError(f"CID não encontrado em diagnosticos: {cid}")
        if especialidade not in esp:
            raise ValueError(f"Especialidade não encontrada: {especialidade}")

        prot_id = conn.execute(ins_prot, {
            "diagnostico_id": diag[cid],
            "idade_min": idade_min,
            "idade_max": idade_max,
            "especialidade_id": esp[especialidade],
            "nome": nome,
            "observacao": obs,
        }).fetchone()[0]
        n_prot += 1

        for med_id, qtd, freq in meds:
            conn.execute(ins_item, {
                "protocolo_id": prot_id,
                "medicamento_id": med_id,
                "quantidade_por_internacao": qtd,
                "frequencia": freq,
            })
            n_item += 1
    return n_prot, n_item


def main():
    ddl = DDL_PATH.read_text(encoding="utf-8")
    with engine.begin() as conn:
        conn.exec_driver_sql(ddl)
        # limpeza idempotente em ordem de FK (filhos -> pais)
        conn.execute(text("DELETE FROM protocolo_medicamentos"))
        conn.execute(text("DELETE FROM protocolos_tratamento"))
        conn.execute(text("DELETE FROM medicamentos"))
        n_med = _migrar_medicamentos(conn)
        n_prot, n_item = _povoar_protocolos(conn)
    print(f"OK — medicamentos: {n_med} | protocolos: {n_prot} | itens de protocolo: {n_item}")


if __name__ == "__main__":
    main()
