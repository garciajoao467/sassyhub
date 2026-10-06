import uuid
from sqlalchemy import Boolean, Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base

class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    nome = Column(String, nullable=False)
    pasta_origem = Column(String, nullable=False)
    pasta_destino = Column(String, nullable=False)
    status_ativo = Column(Boolean, default=True, nullable=False)
    criado_em = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    logs = relationship("Log", back_populates="cliente")

class Log(Base):
    __tablename__ = "logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    cliente_id = Column(String, ForeignKey("clientes.id"), nullable=False)
    data_hora = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status_sucesso = Column(Boolean, nullable=False)
    mensagem = Column(Text, nullable=True)

    cliente = relationship("Cliente", back_populates="logs")

class Configuracao(Base):
    __tablename__ = "configuracoes"

    chave = Column(String, primary_key=True, index=True)
    valor = Column(String, nullable=False)
