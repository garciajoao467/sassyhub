import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

import shutil
import logging

logger = logging.getLogger("WebSync.Database")

# Caminho padrão solicitado pelo usuário (fora do OneDrive para evitar locks e erros de sincronização)
PROD_DB_DIR = r"A:\SASSY SQUARE MARKETING\config rclone"
PROD_DB_PATH = os.path.join(PROD_DB_DIR, "websync.db")

# Fallback local (caso a unidade A: não esteja conectada na máquina atual)
LOCAL_DB_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_DB_PATH = os.path.join(LOCAL_DB_DIR, "websync.db")

def resolve_db_path() -> str:
    # 1. Variável de ambiente explícita
    env_path = os.environ.get("WEBSYNC_DB_PATH")
    if env_path:
        return env_path

    # 2. Caminho padrão oficial no drive A:
    try:
        # Se o drive A: ou a pasta do drive A: estiver acessível
        drive_a = os.path.splitdrive(PROD_DB_DIR)[0] + "\\"
        if os.path.exists(drive_a) or os.path.exists(PROD_DB_DIR):
            os.makedirs(PROD_DB_DIR, exist_ok=True)
            # Se ainda não existir no drive A:, mas já existir a base local com os clientes cadastrados, migra automaticamente
            if not os.path.exists(PROD_DB_PATH) and os.path.exists(LOCAL_DB_PATH):
                try:
                    shutil.copy2(LOCAL_DB_PATH, PROD_DB_PATH)
                    logger.info(f"Banco de dados migrado com sucesso de {LOCAL_DB_PATH} para {PROD_DB_PATH}")
                except Exception as e:
                    logger.warning(f"Aviso ao copiar banco local para {PROD_DB_PATH}: {e}")
            return PROD_DB_PATH
    except Exception as e:
        logger.warning(f"Unidade A: não acessível no momento ({e}). Usando fallback local.")

    # 3. Fallback de contingência local se A: não estiver montado
    return LOCAL_DB_PATH

DB_PATH = resolve_db_path()

# Conexão com SQLite usando o caminho resolvido
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# Para SQLite com FastAPI/Scheduler em ambiente Windows/OneDrive:
# 1. timeout=30 evita OperationalError: database is locked
# 2. check_same_thread=False permite uso em múltiplas threads e async
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={
        "check_same_thread": False,
        "timeout": 30
    }
)

# Ativa WAL (Write-Ahead Logging) e sincronização normal no SQLite
# Isso permite leitura e escrita simultâneas sem bloqueio mútuo e previne locks do OneDrive
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA busy_timeout=30000;")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependência do banco de dados com rollback de segurança
def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

