from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Configuracao
from scheduler import atualizar_agendamento
from pydantic import BaseModel

router = APIRouter(prefix="/api/config", tags=["Configuração"])

class ConfigUpdate(BaseModel):
    sync_mode: str # 'cron' ou 'interval'
    sync_value: str # '02:00' ou '12'

@router.get("/")
def get_config(db: Session = Depends(get_db)):
    mode_conf = db.query(Configuracao).filter(Configuracao.chave == "sync_mode").first()
    val_conf = db.query(Configuracao).filter(Configuracao.chave == "sync_value").first()
    
    return {
        "sync_mode": mode_conf.valor if mode_conf else "cron",
        "sync_value": val_conf.valor if val_conf else "02:00"
    }

@router.post("/")
def update_config(config: ConfigUpdate, db: Session = Depends(get_db)):
    mode_conf = db.query(Configuracao).filter(Configuracao.chave == "sync_mode").first()
    if not mode_conf:
        mode_conf = Configuracao(chave="sync_mode", valor=config.sync_mode)
        db.add(mode_conf)
    else:
        mode_conf.valor = config.sync_mode

    val_conf = db.query(Configuracao).filter(Configuracao.chave == "sync_value").first()
    if not val_conf:
        val_conf = Configuracao(chave="sync_value", valor=config.sync_value)
        db.add(val_conf)
    else:
        val_conf.valor = config.sync_value

    db.commit()
    
    # Atualiza o agendador imediatamente
    atualizar_agendamento()
    
    return {"message": "Configurações atualizadas com sucesso."}
