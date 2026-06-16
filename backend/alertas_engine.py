"""
Motor de alertas operacionais — avalia condições críticas do hospital
e retorna lista de alertas para exibição no painel e WebSocket.
"""
from datetime import datetime
import pandas as pd
import config
from database import engine


def _data_mais_recente(tabela: str, coluna_data: str) -> str:
    df = pd.read_sql(
        f"SELECT MAX(DATE({coluna_data})) AS dt FROM {tabela}", engine
    )
    return str(df["dt"].iloc[0])


def calcular_alertas() -> list[dict]:
    alertas = []
    agora   = datetime.now().isoformat(timespec="seconds")

    # ── 1. Fila do Pronto Atendimento ────────────────────────────────────────
    try:
        data_pa = _data_mais_recente("fila_espera", "data_chegada")
        df_fila = pd.read_sql(
            f"""
            SELECT
                SUM(status IN ('aguardando','em_atendimento')) AS aguardando,
                ROUND(AVG(CASE WHEN data_atendimento IS NOT NULL
                    THEN TIMESTAMPDIFF(MINUTE, data_chegada, data_atendimento)
                    ELSE TIMESTAMPDIFF(MINUTE, data_chegada, NOW()) END), 0
                ) AS tempo_medio_min
            FROM fila_espera
            WHERE DATE(data_chegada) = '{data_pa}'
              AND status != 'desistiu'
            """,
            engine,
        ).fillna(0)

        aguardando  = int(df_fila["aguardando"].iloc[0])
        tempo_medio = int(df_fila["tempo_medio_min"].iloc[0])

        if aguardando >= config.FILA_CRITICA:
            alertas.append({
                "id": "fila_critica",
                "tipo": "critico",
                "categoria": "PA / Fila de Espera",
                "mensagem": f"{aguardando} pacientes aguardando no PA — capacidade operacional excedida.",
                "valor": aguardando,
                "threshold": config.FILA_CRITICA,
                "timestamp": agora,
            })
        elif aguardando >= config.FILA_AVISO:
            alertas.append({
                "id": "fila_aviso",
                "tipo": "aviso",
                "categoria": "PA / Fila de Espera",
                "mensagem": f"{aguardando} pacientes aguardando no PA — atenção ao fluxo.",
                "valor": aguardando,
                "threshold": config.FILA_AVISO,
                "timestamp": agora,
            })

        if tempo_medio >= config.TEMPO_ESPERA_CRITICO:
            alertas.append({
                "id": "tempo_espera_critico",
                "tipo": "critico",
                "categoria": "PA / Tempo de Espera",
                "mensagem": f"Tempo médio de espera: {tempo_medio} min — meta de {config.TEMPO_ESPERA_CRITICO} min excedida.",
                "valor": tempo_medio,
                "threshold": config.TEMPO_ESPERA_CRITICO,
                "timestamp": agora,
            })
        elif tempo_medio >= config.TEMPO_ESPERA_AVISO:
            alertas.append({
                "id": "tempo_espera_aviso",
                "tipo": "aviso",
                "categoria": "PA / Tempo de Espera",
                "mensagem": f"Tempo médio de espera: {tempo_medio} min — monitorar evolução.",
                "valor": tempo_medio,
                "threshold": config.TEMPO_ESPERA_AVISO,
                "timestamp": agora,
            })
    except Exception:
        pass

    # ── 2. Leitos CTI/UTI ────────────────────────────────────────────────────
    try:
        df_cti = pd.read_sql(
            """
            SELECT
                COUNT(*) AS total,
                SUM(status = 'disponivel') AS disponiveis,
                ROUND(SUM(status = 'ocupado') / COUNT(*) * 100, 1) AS taxa_pct
            FROM leitos
            WHERE tipo_id = 3
            """,
            engine,
        ).fillna(0)

        disp_cti = int(df_cti["disponiveis"].iloc[0])
        taxa_cti = float(df_cti["taxa_pct"].iloc[0])

        if disp_cti <= config.LEITOS_CTI_CRITICO:
            alertas.append({
                "id": "cti_critico",
                "tipo": "critico",
                "categoria": "CTI/UTI",
                "mensagem": f"CTI com apenas {disp_cti} leito(s) disponível(is) — risco de superlotação.",
                "valor": disp_cti,
                "threshold": config.LEITOS_CTI_CRITICO,
                "timestamp": agora,
            })
        elif disp_cti <= config.LEITOS_CTI_AVISO:
            alertas.append({
                "id": "cti_aviso",
                "tipo": "aviso",
                "categoria": "CTI/UTI",
                "mensagem": f"CTI com {disp_cti} leitos disponíveis — capacidade reduzida.",
                "valor": disp_cti,
                "threshold": config.LEITOS_CTI_AVISO,
                "timestamp": agora,
            })
    except Exception:
        pass

    # ── 3. Taxa de ocupação geral ────────────────────────────────────────────
    try:
        df_ocup = pd.read_sql(
            """
            SELECT ROUND(SUM(status='ocupado') / COUNT(*) * 100, 1) AS taxa_pct
            FROM leitos
            """,
            engine,
        ).fillna(0)

        taxa = float(df_ocup["taxa_pct"].iloc[0])

        if taxa >= config.TAXA_OCUPACAO_CRITICA:
            alertas.append({
                "id": "ocupacao_critica",
                "tipo": "critico",
                "categoria": "Censo Hospitalar",
                "mensagem": f"Taxa de ocupação hospitalar em {taxa}% — acima do limite crítico.",
                "valor": taxa,
                "threshold": config.TAXA_OCUPACAO_CRITICA,
                "timestamp": agora,
            })
        elif taxa >= config.TAXA_OCUPACAO_AVISO:
            alertas.append({
                "id": "ocupacao_aviso",
                "tipo": "aviso",
                "categoria": "Censo Hospitalar",
                "mensagem": f"Taxa de ocupação hospitalar em {taxa}% — próximo à capacidade máxima.",
                "valor": taxa,
                "threshold": config.TAXA_OCUPACAO_AVISO,
                "timestamp": agora,
            })
    except Exception:
        pass

    # ── 4. Estoque crítico / esgotado ────────────────────────────────────────
    try:
        df_est = pd.read_csv(config.DATA_DIR / "estoque_medicamentos.csv")
        esgotados = df_est[df_est["status_estoque"] == "esgotado"]
        criticos  = df_est[df_est["status_estoque"] == "critico"]

        for _, row in esgotados.iterrows():
            alertas.append({
                "id": f"estoque_esgotado_{int(row['id'])}",
                "tipo": "critico",
                "categoria": "Farmácia / Almoxarifado",
                "mensagem": f"ESTOQUE ZERADO: {row['nome']} ({row['categoria']}).",
                "valor": int(row["quantidade_atual"]),
                "threshold": int(row["quantidade_minima"]),
                "timestamp": agora,
            })

        if len(criticos) >= config.ESTOQUE_CRITICO_MIN:
            alertas.append({
                "id": "estoque_multiplos_criticos",
                "tipo": "aviso",
                "categoria": "Farmácia / Almoxarifado",
                "mensagem": f"{len(criticos)} insumo(s) abaixo do estoque mínimo — acionar ALMOX.",
                "valor": len(criticos),
                "threshold": config.ESTOQUE_CRITICO_MIN,
                "timestamp": agora,
            })
    except Exception:
        pass

    # ── 5. Cobertura de plantão no turno atual ───────────────────────────────
    try:
        from datetime import date as date_cls
        hora = datetime.now().hour
        if 6 <= hora < 14:
            turno_atual = "manha"
        elif 14 <= hora < 22:
            turno_atual = "tarde"
        else:
            turno_atual = "noite"

        data_plantao = _data_mais_recente("plantoes", "data")
        df_plant = pd.read_sql(
            f"""
            SELECT s.nome AS setor, COUNT(*) AS profissionais
            FROM plantoes p
            JOIN setores s ON p.setor_id = s.id
            WHERE p.data = '{data_plantao}'
              AND p.turno = '{turno_atual}'
            GROUP BY s.id, s.nome
            HAVING profissionais < 2
            """,
            engine,
        )

        for _, row in df_plant.iterrows():
            alertas.append({
                "id": f"plantao_baixo_{row['setor'].replace(' ','_')}",
                "tipo": "aviso",
                "categoria": "Escala de Profissionais",
                "mensagem": f"Setor «{row['setor']}» com {int(row['profissionais'])} profissional(is) no turno {turno_atual}.",
                "valor": int(row["profissionais"]),
                "threshold": 2,
                "timestamp": agora,
            })
    except Exception:
        pass

    return alertas
