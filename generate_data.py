"""
Gerador de dados sintéticos para o projeto Hospital Indicadores.

Saídas
------
data/inserts_pacientes.sql
data/inserts_leitos.sql
data/inserts_profissionais.sql
data/inserts_plantoes.sql
data/inserts_internacoes.sql
data/inserts_fila_espera.sql
data/estoque_medicamentos.csv
data/historico_indicadores.csv
data/distribuicao_pacientes.csv
"""

import csv
import os
import random
from datetime import date, datetime, timedelta

from faker import Faker

fake = Faker("pt_BR")
random.seed(42)
Faker.seed(42)

OUT = "data"
os.makedirs(OUT, exist_ok=True)

# ── constantes de domínio (espelham os INSERTs fixos do schema.sql) ──────────

TIPOS_LEITO   = {1: "Enfermaria", 2: "Quarto", 3: "CTI/UTI"}
ESPECIALIDADES = {
    1: "Clínica Geral", 2: "Cardiologia", 3: "Ortopedia",
    4: "Pediatria",     5: "Neurologia",  6: "Pneumologia",
    7: "Gastroenterologia", 8: "Ginecologia e Obstetrícia",
    9: "Urologia",      10: "Oncologia",  11: "Infectologia",
    12: "Nefrologia",   13: "Endocrinologia", 14: "Psiquiatria",
    15: "Dermatologia",
}
SETORES = {
    1: "Pronto Atendimento",    2: "Enfermaria Geral",
    3: "Enfermaria Pediátrica", 4: "Quarto Particular",
    5: "CTI Adulto",            6: "CTI Neonatal",
    7: "Centro Cirúrgico",      8: "Maternidade",
    9: "Oncologia",             10: "Hemodiálise",
}
DIAG_IDS = list(range(1, 26))   # 25 diagnósticos no schema

TODAY      = date.today()
HIST_START = TODAY - timedelta(days=365)   # 1 ano de histórico


# ═══════════════════════════════════════════════════════════════════════════════
# Utilidades
# ═══════════════════════════════════════════════════════════════════════════════

def rnd_date(start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def rnd_datetime(start: datetime, end: datetime) -> datetime:
    delta = int((end - start).total_seconds())
    return start + timedelta(seconds=random.randint(0, delta))


def fmt_dt(dt) -> str:
    if dt is None:
        return "NULL"
    return f"'{dt.strftime('%Y-%m-%d %H:%M:%S')}'"


def fmt_d(d) -> str:
    return f"'{d.strftime('%Y-%m-%d')}'"


def sql_str(s: str) -> str:
    s = s.replace("'", "''")
    return f"'{s}'"


def cpf_fake() -> str:
    nums = [random.randint(0, 9) for _ in range(11)]
    return f"{nums[0]}{nums[1]}{nums[2]}.{nums[3]}{nums[4]}{nums[5]}.{nums[6]}{nums[7]}{nums[8]}-{nums[9]}{nums[10]}"


# ═══════════════════════════════════════════════════════════════════════════════
# 1. PACIENTES  (400 registros)
# ═══════════════════════════════════════════════════════════════════════════════

ESTADOS_BR = [
    "SP","RJ","MG","BA","PR","RS","PE","CE","GO","MA",
    "AM","ES","SC","PB","RN","AL","PA","MT","MS","PI",
]

# distribuição etária realista para hospital público
AGE_GROUPS = [
    (0,  14,  10),
    (15, 29,  12),
    (30, 44,  15),
    (45, 59,  20),
    (60, 74,  25),
    (75, 95,  18),
]

def random_birthdate() -> date:
    weights = [g[2] for g in AGE_GROUPS]
    group   = random.choices(AGE_GROUPS, weights=weights, k=1)[0]
    age     = random.randint(group[0], group[1])
    return TODAY - timedelta(days=age * 365 + random.randint(0, 364))


N_PATIENTS = 400
patients = []
cpfs_used = set()

for i in range(1, N_PATIENTS + 1):
    while True:
        cpf = cpf_fake()
        if cpf not in cpfs_used:
            cpfs_used.add(cpf)
            break
    sexo = random.choice(["M", "F"])
    nome = fake.name_male() if sexo == "M" else fake.name_female()
    dob  = random_birthdate()
    estado = random.choice(ESTADOS_BR)
    patients.append({
        "id":    i,
        "nome":  nome,
        "dob":   dob,
        "sexo":  sexo,
        "cpf":   cpf,
        "cidade": fake.city(),
        "estado": estado,
    })

with open(f"{OUT}/inserts_pacientes.sql", "w", encoding="utf-8") as f:
    f.write("USE hospital_indicadores;\n\n")
    f.write("INSERT INTO pacientes (nome, data_nascimento, sexo, cpf, cidade, estado) VALUES\n")
    rows = []
    for p in patients:
        rows.append(
            f"  ({sql_str(p['nome'])}, {fmt_d(p['dob'])}, '{p['sexo']}', "
            f"{sql_str(p['cpf'])}, {sql_str(p['cidade'])}, '{p['estado']}')"
        )
    f.write(",\n".join(rows) + ";\n")

print(f"[OK] pacientes: {N_PATIENTS}")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. LEITOS  (150 leitos)
# ═══════════════════════════════════════════════════════════════════════════════
# Distribuição: 90 Enfermaria, 30 Quarto, 30 CTI/UTI

LEITO_CFG = [
    # (tipo_id, setor_id, quantidade, prefixo)
    (1, 2, 60, "EG"),   # Enfermaria Geral
    (1, 3, 20, "EP"),   # Enfermaria Pediátrica
    (1, 8, 10, "MA"),   # Maternidade
    (2, 4, 20, "QP"),   # Quarto Particular
    (2, 9, 10, "OQ"),   # Oncologia quarto
    (3, 5, 20, "CA"),   # CTI Adulto
    (3, 6, 10, "CN"),   # CTI Neonatal
]

STATUS_DIST = ["disponivel"] * 55 + ["ocupado"] * 35 + ["manutencao"] * 7 + ["reservado"] * 3

beds = []
bed_id = 1
for tipo_id, setor_id, qty, prefix in LEITO_CFG:
    for n in range(1, qty + 1):
        status = random.choice(STATUS_DIST)
        beds.append({
            "id":      bed_id,
            "numero":  f"{prefix}{n:03d}",
            "tipo_id": tipo_id,
            "setor_id": setor_id,
            "status":  status,
        })
        bed_id += 1

with open(f"{OUT}/inserts_leitos.sql", "w", encoding="utf-8") as f:
    f.write("USE hospital_indicadores;\n\n")
    f.write("INSERT INTO leitos (numero, tipo_id, setor_id, status) VALUES\n")
    rows = [
        f"  ({sql_str(b['numero'])}, {b['tipo_id']}, {b['setor_id']}, '{b['status']}')"
        for b in beds
    ]
    f.write(",\n".join(rows) + ";\n")

print(f"[OK] leitos: {len(beds)}")


# ═══════════════════════════════════════════════════════════════════════════════
# 3. PROFISSIONAIS  (110 registros)
# ═══════════════════════════════════════════════════════════════════════════════
# 50 médicos, 35 enfermeiros, 20 técnicos, 5 fisioterapeutas

PROF_CFG = [
    # (tipo, n, especialidade_ids_possíveis, setor_ids_possíveis)
    ("medico",              50,
     list(ESPECIALIDADES.keys()),
     [1, 2, 3, 4, 5, 7, 8, 9, 10]),
    ("enfermeiro",          35,
     None,
     list(SETORES.keys())),
    ("tecnico_enfermagem",  20,
     None,
     list(SETORES.keys())),
    ("fisioterapeuta",       5,
     None,
     [2, 3, 5, 7]),
]

profissionais = []
prof_id = 1
for tipo, n, esp_ids, set_ids in PROF_CFG:
    for _ in range(n):
        sexo = random.choice(["M", "F"])
        nome = fake.name_male() if sexo == "M" else fake.name_female()
        if tipo == "medico":
            registro = f"CRM/{random.choice(ESTADOS_BR)} {random.randint(10000, 99999)}"
            esp_id   = random.choice(esp_ids)
        else:
            registro = f"COREN/{random.choice(ESTADOS_BR)} {random.randint(100000, 999999)}"
            esp_id   = None
        setor_id = random.choice(set_ids)
        profissionais.append({
            "id":     prof_id,
            "nome":   nome,
            "registro": registro,
            "tipo":   tipo,
            "esp_id": esp_id,
            "setor_id": setor_id,
        })
        prof_id += 1

medico_ids = [p["id"] for p in profissionais if p["tipo"] == "medico"]

with open(f"{OUT}/inserts_profissionais.sql", "w", encoding="utf-8") as f:
    f.write("USE hospital_indicadores;\n\n")
    f.write("INSERT INTO profissionais (nome, registro, tipo, especialidade_id, setor_id) VALUES\n")
    rows = []
    for p in profissionais:
        esp = str(p["esp_id"]) if p["esp_id"] else "NULL"
        rows.append(
            f"  ({sql_str(p['nome'])}, {sql_str(p['registro'])}, '{p['tipo']}', "
            f"{esp}, {p['setor_id']})"
        )
    f.write(",\n".join(rows) + ";\n")

print(f"[OK] profissionais: {len(profissionais)}")


# ═══════════════════════════════════════════════════════════════════════════════
# 4. PLANTÕES  (últimos 60 dias, todos os profissionais)
# ═══════════════════════════════════════════════════════════════════════════════

TURNO_HORARIO = {
    "manha":  (6,  14),
    "tarde":  (14, 22),
    "noite":  (22, 30),   # +24h do dia
}

plantoes = []
plantao_id = 1
start_plantao = TODAY - timedelta(days=60)

for p in profissionais:
    # cada profissional cobre ~15 plantões em 60 dias (1 a cada 4 dias)
    n_plant = random.randint(12, 18)
    dias_usados = set()
    for _ in range(n_plant):
        for _ in range(20):  # tentativas
            d = rnd_date(start_plantao, TODAY)
            turno = random.choice(["manha", "tarde", "noite"])
            key = (d, turno, p["setor_id"])
            if key not in dias_usados:
                dias_usados.add(key)
                break
        h_ini, h_fim = TURNO_HORARIO[turno]
        inicio = datetime(d.year, d.month, d.day, h_ini, 0, 0)
        fim    = inicio + timedelta(hours=8)
        plantoes.append({
            "id":     plantao_id,
            "prof_id": p["id"],
            "data":    d,
            "turno":  turno,
            "inicio": inicio,
            "fim":    fim,
            "setor_id": p["setor_id"],
        })
        plantao_id += 1

with open(f"{OUT}/inserts_plantoes.sql", "w", encoding="utf-8") as f:
    f.write("USE hospital_indicadores;\n\n")
    f.write("INSERT INTO plantoes (profissional_id, data, turno, inicio, fim, setor_id) VALUES\n")
    rows = [
        f"  ({pl['prof_id']}, {fmt_d(pl['data'])}, '{pl['turno']}', "
        f"{fmt_dt(pl['inicio'])}, {fmt_dt(pl['fim'])}, {pl['setor_id']})"
        for pl in plantoes
    ]
    f.write(",\n".join(rows) + ";\n")

print(f"[OK] plantoes: {len(plantoes)}")


# ═══════════════════════════════════════════════════════════════════════════════
# 5. INTERNAÇÕES  (500 registros, últimos 12 meses)
# ═══════════════════════════════════════════════════════════════════════════════

intern_start = datetime(HIST_START.year, HIST_START.month, HIST_START.day)
intern_end   = datetime(TODAY.year, TODAY.month, TODAY.day, 23, 59, 59)

# leitos elegíveis para internação (não CTI por enquanto simplificado)
all_bed_ids = [b["id"] for b in beds]

internacoes = []
intern_id = 1
N_INTERN = 500

for _ in range(N_INTERN):
    paciente_id   = random.randint(1, N_PATIENTS)
    leito_id      = random.choice(all_bed_ids)
    medico_id     = random.choice(medico_ids)
    diag_id       = random.choice(DIAG_IDS)
    data_entrada  = rnd_datetime(intern_start, intern_end - timedelta(days=1))

    # ~30% ainda ativas
    if random.random() < 0.30:
        status     = "ativa"
        data_alta  = None
    else:
        dias_intern = random.randint(1, 30)
        data_alta_dt = data_entrada + timedelta(days=dias_intern,
                                                 hours=random.randint(0, 23))
        if data_alta_dt > datetime.now():
            data_alta_dt = datetime.now() - timedelta(hours=random.randint(1, 12))
        status_opts = ["alta"] * 80 + ["obito"] * 8 + ["transferencia"] * 12
        status      = random.choice(status_opts)
        data_alta   = data_alta_dt

    internacoes.append({
        "id":        intern_id,
        "pac_id":    paciente_id,
        "leito_id":  leito_id,
        "entrada":   data_entrada,
        "alta":      data_alta,
        "status":    status,
        "diag_id":   diag_id,
        "medico_id": medico_id,
    })
    intern_id += 1

with open(f"{OUT}/inserts_internacoes.sql", "w", encoding="utf-8") as f:
    f.write("USE hospital_indicadores;\n\n")
    f.write(
        "INSERT INTO internacoes "
        "(paciente_id, leito_id, data_entrada, data_alta, status, "
        "diagnostico_principal_id, medico_responsavel_id) VALUES\n"
    )
    rows = [
        f"  ({i['pac_id']}, {i['leito_id']}, {fmt_dt(i['entrada'])}, "
        f"{fmt_dt(i['alta'])}, '{i['status']}', {i['diag_id']}, {i['medico_id']})"
        for i in internacoes
    ]
    f.write(",\n".join(rows) + ";\n")

print(f"[OK] internacoes: {len(internacoes)}")


# ═══════════════════════════════════════════════════════════════════════════════
# 6. FILA DE ESPERA  (últimos 90 dias, ~30-80 entradas/dia)
# ═══════════════════════════════════════════════════════════════════════════════

PRIORIDADE_DIST = (
    ["vermelho"] * 5 +
    ["laranja"]  * 15 +
    ["amarelo"]  * 40 +
    ["verde"]    * 30 +
    ["azul"]     * 10
)

QUEIXAS = [
    "Dor no peito", "Falta de ar", "Febre alta", "Dor abdominal",
    "Cefaleia intensa", "Tontura e náusea", "Dor lombar",
    "Queda com trauma", "Convulsão", "Hiperglicemia",
    "Crise hipertensiva", "Dor de garganta", "Tosse persistente",
    "Infecção urinária", "Corte e laceração", "Alergia e urticária",
    "Vômito e diarreia", "Dor articular", "Fraqueza muscular",
    "Desmaio", "Ansiedade e pânico", "Palpitações",
]

fila_espera = []
fila_id = 1
fila_start = TODAY - timedelta(days=90)

d = fila_start
while d <= TODAY:
    # final de semana e segunda têm mais fluxo
    is_weekend = d.weekday() >= 5
    is_monday  = d.weekday() == 0
    base = 60 if (is_weekend or is_monday) else 40
    n_dia = random.randint(base - 10, base + 20)

    for _ in range(n_dia):
        hora    = random.randint(0, 23)
        minuto  = random.randint(0, 59)
        chegada = datetime(d.year, d.month, d.day, hora, minuto)

        prioridade = random.choice(PRIORIDADE_DIST)
        # tempo de espera depende da prioridade
        espera_min = {
            "vermelho": random.randint(0, 10),
            "laranja":  random.randint(5, 30),
            "amarelo":  random.randint(20, 120),
            "verde":    random.randint(60, 240),
            "azul":     random.randint(120, 360),
        }[prioridade]

        atendimento = chegada + timedelta(minutes=espera_min)

        # ~5% desistem antes de ser atendidos
        if random.random() < 0.05:
            status      = "desistiu"
            atendimento = None
        elif d == TODAY and hora >= datetime.now().hour - 1:
            status = random.choice(["aguardando", "em_atendimento"])
            atendimento = None
        else:
            status = random.choice(["atendido"] * 85 + ["encaminhado"] * 15)

        pac_id = random.choice([None] * 30 + list(range(1, N_PATIENTS + 1)))
        if pac_id:
            nome = patients[pac_id - 1]["nome"]
        else:
            nome = fake.name()

        fila_espera.append({
            "id":           fila_id,
            "pac_id":       pac_id,
            "nome":         nome,
            "chegada":      chegada,
            "atendimento":  atendimento if status not in ("aguardando", "em_atendimento", "desistiu") else None,
            "prioridade":   prioridade,
            "queixa":       random.choice(QUEIXAS),
            "status":       status,
        })
        fila_id += 1

    d += timedelta(days=1)

# Escreve em lotes de 500 para não travar o MySQL
BATCH = 500
chunks = [fila_espera[i:i+BATCH] for i in range(0, len(fila_espera), BATCH)]

with open(f"{OUT}/inserts_fila_espera.sql", "w", encoding="utf-8") as f:
    f.write("USE hospital_indicadores;\n\n")
    for chunk in chunks:
        f.write(
            "INSERT INTO fila_espera "
            "(paciente_id, nome_paciente, data_chegada, data_atendimento, "
            "prioridade, queixa_principal, status) VALUES\n"
        )
        rows = []
        for fe in chunk:
            pac = str(fe["pac_id"]) if fe["pac_id"] else "NULL"
            rows.append(
                f"  ({pac}, {sql_str(fe['nome'])}, {fmt_dt(fe['chegada'])}, "
                f"{fmt_dt(fe['atendimento'])}, '{fe['prioridade']}', "
                f"{sql_str(fe['queixa'])}, '{fe['status']}')"
            )
        f.write(",\n".join(rows) + ";\n\n")

print(f"[OK] fila_espera: {len(fila_espera)}")


# ═══════════════════════════════════════════════════════════════════════════════
# 7. CSV — ESTOQUE DE MEDICAMENTOS E MATERIAIS
# ═══════════════════════════════════════════════════════════════════════════════

MEDICAMENTOS = [
    # (nome, categoria, unidade, qtd_atual, qtd_minima)
    ("Soro Fisiológico 0,9% 500ml",      "Soluções IV",        "bolsa",   1800, 500),
    ("Soro Glicosado 5% 500ml",          "Soluções IV",        "bolsa",    950, 300),
    ("Ringer Lactato 500ml",             "Soluções IV",        "bolsa",    600, 200),
    ("Dipirona 500mg/ml amp 2ml",        "Analgésicos",        "ampola",  3200, 800),
    ("Tramadol 50mg/ml amp 2ml",         "Analgésicos Opioides","ampola",  800, 200),
    ("Morfina 10mg/ml amp 1ml",          "Analgésicos Opioides","ampola",  350, 100),
    ("Omeprazol 40mg fr-amp",            "Protetores Gástricos","frasco",  700, 200),
    ("Metoclopramida 5mg/ml amp 2ml",    "Antiemeticos",       "ampola", 1100, 300),
    ("Ondansetrona 2mg/ml amp 4ml",      "Antiemeticos",       "ampola",  480, 150),
    ("Diazepam 5mg/ml amp 2ml",          "Benzodiazepínicos",  "ampola",  260, 80),
    ("Midazolam 5mg/ml amp 10ml",        "Benzodiazepínicos",  "ampola",  190, 60),
    ("Amoxicilina + Clavulanato 1g fr",  "Antibióticos",       "frasco",  420, 100),
    ("Ceftriaxona 1g fr-amp",            "Antibióticos",       "frasco",  680, 200),
    ("Ciprofloxacino 200mg/100ml",       "Antibióticos",       "frasco",  310, 80),
    ("Vancomicina 500mg fr-amp",         "Antibióticos",       "frasco",  220, 60),
    ("Piperacilina+Tazobactam 4,5g fr",  "Antibióticos",       "frasco",  180, 50),
    ("Meropenem 1g fr-amp",              "Antibióticos",       "frasco",  140, 40),
    ("Heparina Sódica 5000UI/ml 5ml",    "Anticoagulantes",    "ampola",  600, 150),
    ("Enoxaparina 40mg seringa",         "Anticoagulantes",    "seringa", 450, 120),
    ("Furosemida 10mg/ml amp 2ml",       "Diuréticos",         "ampola",  900, 250),
    ("Hidroclorotiazida 25mg cp",        "Diuréticos",         "comprimido", 2800, 700),
    ("Metoprolol 5mg/ml amp 5ml",        "Betabloqueadores",   "ampola",  310, 80),
    ("Atenolol 25mg cp",                 "Betabloqueadores",   "comprimido", 1900, 500),
    ("Captopril 25mg cp",                "Anti-hipertensivos", "comprimido", 3500, 900),
    ("Losartana 50mg cp",                "Anti-hipertensivos", "comprimido", 2700, 700),
    ("Enalaprilato 1,25mg/ml amp 2ml",   "Anti-hipertensivos", "ampola",  290, 80),
    ("Nitroprussiato 50mg fr-amp",       "Vasodilatadores",    "frasco",   90, 25),
    ("Dopamina 5mg/ml amp 10ml",         "Vasopressores",      "ampola",  170, 50),
    ("Norepinefrina 1mg/ml amp 4ml",     "Vasopressores",      "ampola",  140, 40),
    ("Adrenalina 1mg/ml amp 1ml",        "Vasopressores",      "ampola",  500, 120),
    ("Atropina 0,5mg/ml amp 1ml",        "Anticolinérgicos",   "ampola",  380, 100),
    ("Glicose 50% amp 10ml",             "Soluções IV",        "ampola",  600, 150),
    ("Insulina Regular 100UI/ml 10ml",   "Antidiabéticos",     "frasco",  240, 60),
    ("Insulina NPH 100UI/ml 10ml",       "Antidiabéticos",     "frasco",  190, 50),
    ("Dexametasona 4mg/ml amp 2,5ml",    "Corticosteroides",   "ampola",  750, 200),
    ("Metilprednisolona 125mg fr-amp",   "Corticosteroides",   "frasco",  280, 80),
    ("Hidrocortisona 500mg fr-amp",      "Corticosteroides",   "frasco",  220, 60),
    ("Fenobarbital 100mg/ml amp 2ml",    "Anticonvulsivantes", "ampola",  190, 50),
    ("Valproato 500mg/5ml amp",          "Anticonvulsivantes", "ampola",  160, 40),
    ("Levetiracetam 500mg/5ml fr",       "Anticonvulsivantes", "frasco",  130, 35),
    ("Sulfato de Magnésio 10% 10ml",     "Eletrólitos IV",     "ampola",  820, 200),
    ("Cloreto de Potássio 10% 10ml",     "Eletrólitos IV",     "ampola",  950, 250),
    ("Bicarbonato de Sódio 8,4% 10ml",   "Eletrólitos IV",     "ampola",  480, 120),
    ("Phytomenadione 10mg/ml amp 1ml",   "Hemostáticos",       "ampola",  210, 60),
    ("Ácido Tranexâmico 50mg/ml 10ml",   "Hemostáticos",       "ampola",  170, 50),
    ("Glicerina Líquida 12g/ml 120ml",   "Laxantes",           "frasco",  380, 100),
    ("Lactulose Xarope 667mg/ml 150ml",  "Laxantes",           "frasco",  290, 80),
    ("Salbutamol Spray 100mcg/dose",     "Broncodilatadores",  "frasco",  310, 80),
    ("Ipratrópio 0,25mg/ml nebulização", "Broncodilatadores",  "frasco",  260, 70),
    ("Aminofilina 24mg/ml amp 10ml",     "Broncodilatadores",  "ampola",  200, 55),
    # Materiais hospitalares
    ("Luva de Procedimento M",           "EPI",                "par",    5200, 1000),
    ("Luva de Procedimento G",           "EPI",                "par",    4800, 1000),
    ("Máscara Cirúrgica tripla",         "EPI",                "unidade",3800, 800),
    ("Máscara N95",                      "EPI",                "unidade",1200, 300),
    ("Seringa 10ml",                     "Material de Infusão","unidade",2600, 600),
    ("Agulha 25x8",                      "Material de Infusão","unidade",3100, 700),
    ("Jelco 18G",                        "Material de Infusão","unidade",1800, 400),
    ("Jelco 20G",                        "Material de Infusão","unidade",2100, 500),
    ("Equipo Macro Gotejador",           "Material de Infusão","unidade",1900, 450),
    ("Gaze Estéril 7,5x7,5 c/5",        "Curativos",          "pacote", 1400, 350),
    ("Atadura Crepom 10cm",              "Curativos",          "rolo",    960, 250),
    ("Esparadrapo Antialérgico 10x4,5m", "Curativos",          "rolo",    480, 120),
    ("Sonda Nasogástrica nº 12",         "Sondas",             "unidade",  290, 70),
    ("Sonda Foley 2 Vias 14Fr",          "Sondas",             "unidade",  380, 90),
    ("Coletor de Urina 2L",              "Sondas",             "unidade",  420, 100),
    ("Máscara de Nebulização Adulto",    "Respiratório",       "unidade",  560, 140),
    ("Cateter Nasal O2 Adulto",          "Respiratório",       "unidade",  640, 160),
]

FORNECEDORES = [
    "MedPharma Distribuidora",
    "HospitalMed Suprimentos",
    "BioSaúde Comércio",
    "FarmaHosp Brasil",
    "DistribMed Nordeste",
]

with open(f"{OUT}/estoque_medicamentos.csv", "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    writer.writerow([
        "id", "nome", "categoria", "unidade",
        "quantidade_atual", "quantidade_minima",
        "percentual_disponibilidade",
        "status_estoque",
        "fornecedor", "validade", "localizacao_almoxarifado",
    ])
    for idx, item in enumerate(MEDICAMENTOS, 1):
        nome, cat, unid, qtd_atual, qtd_min = item
        # adiciona variação aleatória realista
        qtd_atual = max(0, qtd_atual + random.randint(-int(qtd_atual * 0.20), int(qtd_atual * 0.20)))
        perc = round(qtd_atual / (qtd_min * 4) * 100, 1)  # 100% = 4x mínimo
        if qtd_atual == 0:
            status = "esgotado"
        elif qtd_atual < qtd_min:
            status = "critico"
        elif qtd_atual < qtd_min * 2:
            status = "baixo"
        else:
            status = "adequado"
        validade = TODAY + timedelta(days=random.randint(30, 730))
        ala = random.choice(["A", "B", "C"])
        prateleira = random.randint(1, 20)
        writer.writerow([
            idx, nome, cat, unid,
            qtd_atual, qtd_min,
            min(perc, 100.0),
            status,
            random.choice(FORNECEDORES),
            validade.strftime("%Y-%m-%d"),
            f"ALMO-{ala}{prateleira:02d}",
        ])

print(f"[OK] estoque_medicamentos.csv: {len(MEDICAMENTOS)} itens")


# ═══════════════════════════════════════════════════════════════════════════════
# 8. CSV — HISTÓRICO DE INDICADORES DIÁRIOS  (365 dias)
# ═══════════════════════════════════════════════════════════════════════════════

# Parâmetros de simulação de série temporal
TOTAL_BEDS = len(beds)
BEDS_ENF   = sum(1 for b in beds if b["tipo_id"] == 1)
BEDS_QTO   = sum(1 for b in beds if b["tipo_id"] == 2)
BEDS_CTI   = sum(1 for b in beds if b["tipo_id"] == 3)

with open(f"{OUT}/historico_indicadores.csv", "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    writer.writerow([
        "data",
        "internacoes_ativas",
        "leitos_disponiveis_total",
        "leitos_disponiveis_enfermaria",
        "leitos_disponiveis_quarto",
        "leitos_disponiveis_cti",
        "taxa_ocupacao_pct",
        "taxa_ocupacao_cti_pct",
        "fila_espera_media_dia",
        "fila_espera_pico",
        "pacientes_atendidos_pa",
        "tempo_espera_medio_min",
        "altas_dia",
        "obitos_dia",
        "transferencias_dia",
        "novos_internados_dia",
        "cirurgias_realizadas",
    ])

    # Estado inicial
    intern_ativas = random.randint(95, 110)
    leitos_ocup   = intern_ativas
    fila_base     = 35

    d = HIST_START
    while d <= TODAY:
        dia_semana = d.weekday()  # 0=seg … 6=dom
        is_weekend = dia_semana >= 5

        # variação sazonal (inverno = mais doentes)
        mes = d.month
        fator_sazonal = 1.0 + 0.15 * (mes in (5, 6, 7, 8))   # jun-set

        # altas e novos internados
        altas          = random.randint(3, 10)
        obitos         = random.randint(0, 2) if random.random() < 0.3 else 0
        transferencias = random.randint(0, 2) if random.random() < 0.2 else 0
        saidas         = altas + obitos + transferencias

        novos = random.randint(4, 12)
        intern_ativas = max(60, min(TOTAL_BEDS - 10, intern_ativas - saidas + novos))
        leitos_ocup   = intern_ativas

        disp_total = TOTAL_BEDS - leitos_ocup
        disp_enf   = max(0, int(BEDS_ENF * (1 - leitos_ocup / TOTAL_BEDS)) + random.randint(-3, 3))
        disp_qto   = max(0, int(BEDS_QTO * (1 - leitos_ocup / TOTAL_BEDS)) + random.randint(-2, 2))
        disp_cti   = max(0, BEDS_CTI - max(0, intern_ativas - BEDS_ENF - BEDS_QTO))

        taxa_ocup     = round(leitos_ocup / TOTAL_BEDS * 100, 1)
        taxa_ocup_cti = round((BEDS_CTI - disp_cti) / BEDS_CTI * 100, 1)

        fator_dia = 1.3 if is_weekend else 1.0
        fila_med  = int(fila_base * fator_sazonal * fator_dia + random.randint(-5, 10))
        fila_pico = int(fila_med * random.uniform(1.4, 2.2))
        atendidos = int(fila_med * random.uniform(0.9, 1.2) * 8)  # turnos
        t_espera  = random.randint(25, 140)
        cirurgias = random.randint(3, 12)

        writer.writerow([
            d.strftime("%Y-%m-%d"),
            intern_ativas,
            disp_total, disp_enf, disp_qto, disp_cti,
            taxa_ocup, taxa_ocup_cti,
            fila_med, fila_pico,
            atendidos, t_espera,
            altas, obitos, transferencias, novos,
            cirurgias,
        ])
        d += timedelta(days=1)

print("[OK] historico_indicadores.csv: 365 dias")


# ═══════════════════════════════════════════════════════════════════════════════
# 9. CSV — DISTRIBUIÇÃO DE PACIENTES POR FAIXA ETÁRIA E SEXO  (mensal, 24 meses)
# ═══════════════════════════════════════════════════════════════════════════════

FAIXAS = [
    ("0-14",   0.08),
    ("15-29",  0.10),
    ("30-44",  0.13),
    ("45-59",  0.20),
    ("60-74",  0.28),
    ("75+",    0.21),
]

with open(f"{OUT}/distribuicao_pacientes.csv", "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    writer.writerow([
        "ano", "mes", "mes_nome",
        "faixa_etaria", "sexo",
        "total_atendimentos", "total_internacoes",
    ])

    MESES_PT = [
        "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ]

    base_date = TODAY.replace(day=1) - timedelta(days=365*2)
    for m_offset in range(25):
        year  = (base_date.replace(day=1) + timedelta(days=31 * m_offset)).year
        month = (base_date.replace(day=1) + timedelta(days=31 * m_offset)).month
        mes_nome = MESES_PT[month]

        # inverno tem +20% atendimentos
        fator = 1.0 + 0.20 * (month in (5, 6, 7, 8))

        for faixa, peso in FAIXAS:
            for sexo in ("M", "F"):
                # mulheres têm leve predominância nas faixas mais velhas
                s_fator = 1.08 if (sexo == "F" and faixa in ("60-74", "75+")) else 1.0
                base_atend = int(280 * peso * s_fator * fator)
                atend      = base_atend + random.randint(-20, 20)
                intern     = int(atend * random.uniform(0.12, 0.28))
                writer.writerow([year, month, mes_nome, faixa, sexo, max(0, atend), max(0, intern)])

print("[OK] distribuicao_pacientes.csv: 24 meses")

# ═══════════════════════════════════════════════════════════════════════════════
print("\n[CONCLUIDO] Todos os arquivos gerados em ./data/")
print("  SQL: inserts_pacientes.sql | inserts_leitos.sql | inserts_profissionais.sql")
print("       inserts_plantoes.sql  | inserts_internacoes.sql | inserts_fila_espera.sql")
print("  CSV: estoque_medicamentos.csv | historico_indicadores.csv | distribuicao_pacientes.csv")
