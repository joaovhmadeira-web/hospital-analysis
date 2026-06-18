-- =============================================================
-- HOSPITAL PÚBLICO - SISTEMA DE INDICADORES
-- Schema PostgreSQL (Supabase)
-- =============================================================

-- -------------------------------------------------------------
-- Tabelas de domínio / lookup
-- -------------------------------------------------------------

CREATE TABLE tipos_leito (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(30) NOT NULL
);

CREATE TABLE especialidades (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL
);

CREATE TABLE setores (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    andar SMALLINT NOT NULL DEFAULT 1,
    ala VARCHAR(10)
);

CREATE TABLE diagnosticos (
    id SERIAL PRIMARY KEY,
    cid_codigo VARCHAR(10) NOT NULL UNIQUE,
    descricao VARCHAR(200) NOT NULL,
    categoria VARCHAR(100) NOT NULL
);

-- -------------------------------------------------------------
-- Pacientes
-- -------------------------------------------------------------

CREATE TABLE pacientes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    data_nascimento DATE NOT NULL,
    sexo CHAR(1) CHECK (sexo IN ('M','F')) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    cidade VARCHAR(80) NOT NULL DEFAULT 'Não informado',
    estado CHAR(2) NOT NULL DEFAULT 'XX',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------
-- Leitos
-- -------------------------------------------------------------

CREATE TABLE leitos (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(10) NOT NULL,
    tipo_id INTEGER NOT NULL REFERENCES tipos_leito(id),
    setor_id INTEGER NOT NULL REFERENCES setores(id),
    status VARCHAR(20) CHECK (status IN ('disponivel','ocupado','manutencao','reservado')) NOT NULL DEFAULT 'disponivel',
    UNIQUE (numero, setor_id)
);

-- -------------------------------------------------------------
-- Profissionais de saúde
-- -------------------------------------------------------------

CREATE TABLE profissionais (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    registro VARCHAR(20) NOT NULL,
    tipo VARCHAR(30) CHECK (tipo IN ('medico','enfermeiro','tecnico_enfermagem','fisioterapeuta','outro')) NOT NULL,
    especialidade_id INTEGER REFERENCES especialidades(id),
    setor_id INTEGER REFERENCES setores(id),
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

-- -------------------------------------------------------------
-- Plantões
-- -------------------------------------------------------------

CREATE TABLE plantoes (
    id SERIAL PRIMARY KEY,
    profissional_id INTEGER NOT NULL REFERENCES profissionais(id),
    data DATE NOT NULL,
    turno VARCHAR(10) CHECK (turno IN ('manha','tarde','noite')) NOT NULL,
    inicio TIMESTAMP NOT NULL,
    fim TIMESTAMP NOT NULL,
    setor_id INTEGER NOT NULL REFERENCES setores(id)
);
CREATE INDEX idx_plantao_data ON plantoes(data);
CREATE INDEX idx_plantao_prof ON plantoes(profissional_id);

-- -------------------------------------------------------------
-- Internações
-- -------------------------------------------------------------

CREATE TABLE internacoes (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id),
    leito_id INTEGER NOT NULL REFERENCES leitos(id),
    data_entrada TIMESTAMP NOT NULL,
    data_alta TIMESTAMP NULL,
    status VARCHAR(20) CHECK (status IN ('ativa','alta','obito','transferencia')) NOT NULL DEFAULT 'ativa',
    diagnostico_principal_id INTEGER NOT NULL REFERENCES diagnosticos(id),
    medico_responsavel_id INTEGER NOT NULL REFERENCES profissionais(id)
);
CREATE INDEX idx_intern_entrada ON internacoes(data_entrada);
CREATE INDEX idx_intern_status ON internacoes(status);

-- -------------------------------------------------------------
-- Fila de espera — Pronto Atendimento (Triagem de Manchester)
-- -------------------------------------------------------------

CREATE TABLE fila_espera (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER NULL REFERENCES pacientes(id),
    nome_paciente VARCHAR(120) NOT NULL,
    data_chegada TIMESTAMP NOT NULL,
    data_atendimento TIMESTAMP NULL,
    prioridade VARCHAR(20) CHECK (prioridade IN ('vermelho','laranja','amarelo','verde','azul')) NOT NULL,
    queixa_principal VARCHAR(200) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('aguardando','em_atendimento','atendido','desistiu','encaminhado')) NOT NULL DEFAULT 'aguardando'
);
CREATE INDEX idx_fila_chegada ON fila_espera(data_chegada);
CREATE INDEX idx_fila_status ON fila_espera(status);
CREATE INDEX idx_fila_prioridade ON fila_espera(prioridade);

-- =============================================================
-- Dados de domínio fixos
-- =============================================================

INSERT INTO tipos_leito (nome) VALUES ('Enfermaria'), ('Quarto'), ('CTI/UTI');

INSERT INTO especialidades (nome) VALUES
  ('Clínica Geral'),
  ('Cardiologia'),
  ('Ortopedia'),
  ('Pediatria'),
  ('Neurologia'),
  ('Pneumologia'),
  ('Gastroenterologia'),
  ('Ginecologia e Obstetrícia'),
  ('Urologia'),
  ('Oncologia'),
  ('Infectologia'),
  ('Nefrologia'),
  ('Endocrinologia'),
  ('Psiquiatria'),
  ('Dermatologia');

INSERT INTO setores (nome, andar, ala) VALUES
  ('Pronto Atendimento',        1, 'A'),
  ('Enfermaria Geral',          2, 'B'),
  ('Enfermaria Pediátrica',     2, 'C'),
  ('Quarto Particular',         3, 'A'),
  ('CTI Adulto',                4, 'A'),
  ('CTI Neonatal',              4, 'B'),
  ('Centro Cirúrgico',          3, 'C'),
  ('Maternidade',               2, 'D'),
  ('Oncologia',                 3, 'B'),
  ('Hemodiálise',               1, 'B');

INSERT INTO diagnosticos (cid_codigo, descricao, categoria) VALUES
  ('J18.9',  'Pneumonia não especificada',                    'Doenças Respiratórias'),
  ('I21.9',  'Infarto agudo do miocárdio não especificado',   'Doenças Cardiovasculares'),
  ('I10',    'Hipertensão essencial',                         'Doenças Cardiovasculares'),
  ('E11.9',  'Diabetes mellitus tipo 2 sem complicações',     'Doenças Endócrinas'),
  ('J44.1',  'DPOC com exacerbação aguda',                    'Doenças Respiratórias'),
  ('N18.9',  'Doença renal crônica não especificada',         'Doenças Renais'),
  ('K80.1',  'Cálculo da vesícula biliar com colecistite aguda', 'Doenças Digestivas'),
  ('S72.0',  'Fratura do colo do fêmur',                     'Lesões e Traumatismos'),
  ('A41.9',  'Sepse não especificada',                        'Infecções e Parasitoses'),
  ('G47.3',  'Apneia do sono',                               'Doenças Neurológicas'),
  ('C34.1',  'Neoplasia maligna do lobo superior do pulmão',  'Neoplasias'),
  ('I63.9',  'Acidente vascular cerebral isquêmico',         'Doenças Cardiovasculares'),
  ('K29.7',  'Gastrite não especificada',                    'Doenças Digestivas'),
  ('J06.9',  'Infecção aguda das vias aéreas superiores',    'Doenças Respiratórias'),
  ('R55',    'Síncope e colapso',                            'Sintomas e Sinais Gerais'),
  ('T78.4',  'Alergia não especificada',                     'Reações Alérgicas'),
  ('M54.5',  'Dor lombar',                                   'Doenças Osteomusculares'),
  ('R51',    'Cefaleia',                                     'Sintomas e Sinais Gerais'),
  ('N39.0',  'Infecção do trato urinário',                   'Doenças Renais'),
  ('A09',    'Gastroenterite infecciosa',                    'Infecções e Parasitoses'),
  ('I50.9',  'Insuficiência cardíaca não especificada',      'Doenças Cardiovasculares'),
  ('F32.9',  'Episódio depressivo não especificado',         'Transtornos Mentais'),
  ('E86',    'Depleção de volume (desidratação)',             'Doenças Endócrinas'),
  ('K57.3',  'Doença diverticular do intestino grosso sem complicação', 'Doenças Digestivas'),
  ('B34.9',  'Infecção viral não especificada',              'Infecções e Parasitoses');
