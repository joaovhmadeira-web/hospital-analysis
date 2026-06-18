-- =============================================================
-- HOSPITAL PÚBLICO - PROTOCOLOS CLÍNICOS
-- Schema PostgreSQL (Supabase) — extensão do modelo base
--
-- Objetivo: dado o diagnóstico de uma internação + a idade do
-- paciente, determinar (a) os medicamentos necessários e (b) a
-- especialidade médica que deve conduzir o tratamento.
-- Isso permite projetar demanda de Farmácia/Almoxarifado e
-- detectar lacunas de cobertura na escala de plantão.
-- =============================================================

-- -------------------------------------------------------------
-- Medicamentos / insumos (migrado do CSV estoque_medicamentos)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medicamentos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    categoria VARCHAR(80) NOT NULL,
    unidade VARCHAR(30) NOT NULL,
    quantidade_atual INTEGER NOT NULL DEFAULT 0,
    quantidade_minima INTEGER NOT NULL DEFAULT 0,
    percentual_disponibilidade NUMERIC(5,1) NOT NULL DEFAULT 0,
    status_estoque VARCHAR(20) NOT NULL DEFAULT 'adequado'
        CHECK (status_estoque IN ('adequado','baixo','critico','esgotado')),
    fornecedor VARCHAR(120),
    validade DATE,
    localizacao_almoxarifado VARCHAR(20)
);

-- -------------------------------------------------------------
-- Protocolo de tratamento: diagnóstico + faixa etária
-- -> especialidade exigida
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS protocolos_tratamento (
    id SERIAL PRIMARY KEY,
    diagnostico_id INTEGER NOT NULL REFERENCES diagnosticos(id),
    idade_min SMALLINT NOT NULL DEFAULT 0,
    idade_max SMALLINT NOT NULL DEFAULT 120,
    especialidade_id INTEGER NOT NULL REFERENCES especialidades(id),
    nome VARCHAR(160) NOT NULL,
    observacao VARCHAR(300),
    CONSTRAINT chk_faixa_etaria CHECK (idade_min <= idade_max),
    CONSTRAINT uq_protocolo_diag_faixa UNIQUE (diagnostico_id, idade_min, idade_max)
);
CREATE INDEX IF NOT EXISTS idx_protocolo_diag ON protocolos_tratamento(diagnostico_id);
CREATE INDEX IF NOT EXISTS idx_protocolo_esp  ON protocolos_tratamento(especialidade_id);

-- -------------------------------------------------------------
-- Itens (medicamentos) de cada protocolo
-- quantidade_por_internacao = consumo total estimado por internação
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS protocolo_medicamentos (
    id SERIAL PRIMARY KEY,
    protocolo_id INTEGER NOT NULL REFERENCES protocolos_tratamento(id) ON DELETE CASCADE,
    medicamento_id INTEGER NOT NULL REFERENCES medicamentos(id),
    quantidade_por_internacao INTEGER NOT NULL DEFAULT 1,
    frequencia VARCHAR(60),
    CONSTRAINT uq_protocolo_medicamento UNIQUE (protocolo_id, medicamento_id)
);
CREATE INDEX IF NOT EXISTS idx_protmed_prot ON protocolo_medicamentos(protocolo_id);
CREATE INDEX IF NOT EXISTS idx_protmed_med  ON protocolo_medicamentos(medicamento_id);
