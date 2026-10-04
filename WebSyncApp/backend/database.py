from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Conexão com SQLite
SQLALCHEMY_DATABASE_URL = "sqlite:///./websync.db"

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
