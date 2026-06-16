-- =============================================================
-- HOSPITAL PÚBLICO - SISTEMA DE INDICADORES
-- Schema MySQL
-- =============================================================

CREATE DATABASE IF NOT EXISTS hospital_indicadores
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE hospital_indicadores;

-- -------------------------------------------------------------
-- Tabelas de domínio / lookup
-- -------------------------------------------------------------

CREATE TABLE tipos_leito (
    id   TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(30) NOT NULL   -- 'Enfermaria', 'Quarto', 'CTI/UTI'
);

CREATE TABLE especialidades (
    id   SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(100) NOT NULL
);

CREATE TABLE setores (
    id    SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    nome  VARCHAR(100) NOT NULL,
    andar TINYINT NOT NULL DEFAULT 1,
    ala   VARCHAR(10)
);

CREATE TABLE diagnosticos (
    id         SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    cid_codigo VARCHAR(10)  NOT NULL,
    descricao  VARCHAR(200) NOT NULL,
    categoria  VARCHAR(100) NOT NULL,
    UNIQUE KEY uk_cid (cid_codigo)
);

-- -------------------------------------------------------------
-- Pacientes
-- -------------------------------------------------------------

CREATE TABLE pacientes (
    id               INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    nome             VARCHAR(120) NOT NULL,
    data_nascimento  DATE         NOT NULL,
    sexo             ENUM('M','F') NOT NULL,
    cpf              VARCHAR(14)  NOT NULL,
    cidade           VARCHAR(80)  NOT NULL DEFAULT 'Não informado',
    estado           CHAR(2)      NOT NULL DEFAULT 'XX',
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_cpf (cpf)
);

-- -------------------------------------------------------------
-- Leitos
-- -------------------------------------------------------------

CREATE TABLE leitos (
    id         SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    numero     VARCHAR(10) NOT NULL,
    tipo_id    TINYINT UNSIGNED  NOT NULL,
    setor_id   SMALLINT UNSIGNED NOT NULL,
    status     ENUM('disponivel','ocupado','manutencao','reservado') NOT NULL DEFAULT 'disponivel',
    FOREIGN KEY (tipo_id)  REFERENCES tipos_leito(id),
    FOREIGN KEY (setor_id) REFERENCES setores(id),
    UNIQUE KEY uk_leito (numero, setor_id)
);

-- -------------------------------------------------------------
-- Profissionais de saúde
-- -------------------------------------------------------------

CREATE TABLE profissionais (
    id               SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    nome             VARCHAR(120) NOT NULL,
    registro         VARCHAR(20)  NOT NULL,  -- CRM ou COREN
    tipo             ENUM('medico','enfermeiro','tecnico_enfermagem','fisioterapeuta','outro') NOT NULL,
    especialidade_id SMALLINT UNSIGNED NULL,
    setor_id         SMALLINT UNSIGNED NULL,
    ativo            TINYINT(1) NOT NULL DEFAULT 1,
    FOREIGN KEY (especialidade_id) REFERENCES especialidades(id),
    FOREIGN KEY (setor_id)         REFERENCES setores(id)
);

-- -------------------------------------------------------------
-- Plantões
-- -------------------------------------------------------------

CREATE TABLE plantoes (
    id               INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    profissional_id  SMALLINT UNSIGNED NOT NULL,
    data             DATE         NOT NULL,
    turno            ENUM('manha','tarde','noite') NOT NULL,  -- 06-14 / 14-22 / 22-06
    inicio           DATETIME     NOT NULL,
    fim              DATETIME     NOT NULL,
    setor_id         SMALLINT UNSIGNED NOT NULL,
    FOREIGN KEY (profissional_id) REFERENCES profissionais(id),
    FOREIGN KEY (setor_id)        REFERENCES setores(id),
    KEY idx_plantao_data (data),
    KEY idx_plantao_prof (profissional_id)
);

-- -------------------------------------------------------------
-- Internações
-- -------------------------------------------------------------

CREATE TABLE internacoes (
    id                       INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    paciente_id              INT UNSIGNED      NOT NULL,
    leito_id                 SMALLINT UNSIGNED NOT NULL,
    data_entrada             DATETIME          NOT NULL,
    data_alta                DATETIME          NULL,
    status                   ENUM('ativa','alta','obito','transferencia') NOT NULL DEFAULT 'ativa',
    diagnostico_principal_id SMALLINT UNSIGNED NOT NULL,
    medico_responsavel_id    SMALLINT UNSIGNED NOT NULL,
    FOREIGN KEY (paciente_id)              REFERENCES pacientes(id),
    FOREIGN KEY (leito_id)                 REFERENCES leitos(id),
    FOREIGN KEY (diagnostico_principal_id) REFERENCES diagnosticos(id),
    FOREIGN KEY (medico_responsavel_id)    REFERENCES profissionais(id),
    KEY idx_intern_entrada (data_entrada),
    KEY idx_intern_status  (status)
);

-- -------------------------------------------------------------
-- Fila de espera — Pronto Atendimento (Triagem de Manchester)
-- -------------------------------------------------------------

CREATE TABLE fila_espera (
    id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    paciente_id       INT UNSIGNED NULL,         -- NULL até triagem formal
    nome_paciente     VARCHAR(120) NOT NULL,
    data_chegada      DATETIME     NOT NULL,
    data_atendimento  DATETIME     NULL,
    prioridade        ENUM('vermelho','laranja','amarelo','verde','azul') NOT NULL,
    queixa_principal  VARCHAR(200) NOT NULL,
    status            ENUM('aguardando','em_atendimento','atendido','desistiu','encaminhado') NOT NULL DEFAULT 'aguardando',
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
    KEY idx_fila_chegada   (data_chegada),
    KEY idx_fila_status    (status),
    KEY idx_fila_prioridade (prioridade)
);

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
