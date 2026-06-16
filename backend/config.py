import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

ROOT     = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"

DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = int(os.getenv("DB_PORT", 3306))
DB_USER     = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME     = os.getenv("DB_NAME", "hospital_indicadores")

# Limiares de alerta operacional
FILA_CRITICA          = 50   # pacientes
FILA_AVISO            = 30
TEMPO_ESPERA_CRITICO  = 120  # minutos
TEMPO_ESPERA_AVISO    = 60
LEITOS_CTI_CRITICO    = 3    # leitos livres
LEITOS_CTI_AVISO      = 6
TAXA_OCUPACAO_CRITICA = 90   # %
TAXA_OCUPACAO_AVISO   = 80
ESTOQUE_CRITICO_MIN   = 5    # itens críticos para disparar alerta

ALERT_INTERVAL_SEC = 20      # frequência do WebSocket
