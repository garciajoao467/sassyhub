import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Obtém o diretório atual onde este arquivo está (pasta backend)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "websync.db")

# Conexão com SQLite usando o caminho absoluto
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# Para SQLite é necessário desativar check_same_thread
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependência do banco de dados
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
