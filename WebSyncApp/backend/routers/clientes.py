from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import schemas
from models import Cliente, Log
from scheduler import rotina_diaria_sync
from services.sync_service import executar_sync, executar_sync_stream

router = APIRouter(prefix="/api/clientes", tags=["Clientes"])


@router.get("/", response_model=List[schemas.ClienteResponse])
def listar_clientes(db: Session = Depends(get_db)):
    """Lista todos os clientes."""
    clientes = db.query(Cliente).all()
    return clientes

@router.post("/", response_model=schemas.ClienteResponse)
def criar_cliente(cliente: schemas.ClienteCreate, db: Session = Depends(get_db)):
    """Registra um novo cliente."""
    novo_cliente = Cliente(
        nome=cliente.nome,
        pasta_origem=cliente.pasta_origem,
        pasta_destino=cliente.pasta_destino,
        status_ativo=cliente.status_ativo
    )
    db.add(novo_cliente)
    db.commit()
    db.refresh(novo_cliente)
    return novo_cliente

@router.post("/sync-global")
def sync_global_clientes(background_tasks: BackgroundTasks):
    """Aciona manualmente a rotina global de sincronização (todos os clientes ativos) em background."""
    background_tasks.add_task(rotina_diaria_sync)
    return {"mensagem": "Sincronização global (sequencial) iniciada em background."}


@router.put("/{id}", response_model=schemas.ClienteResponse)
def atualizar_cliente(id: str, cliente_update: schemas.ClienteUpdate, db: Session = Depends(get_db)):
    """Atualiza as configurações de um cliente existente."""
    cliente = db.query(Cliente).filter(Cliente.id == id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    update_data = cliente_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(cliente, key, value)
        
    db.commit()
    db.refresh(cliente)
    return cliente

@router.patch("/{id}/status", response_model=schemas.ClienteResponse)
def atualizar_status_cliente(id: str, status_update: schemas.ClienteStatusUpdate, db: Session = Depends(get_db)):
    """Ativa ou desativa a sincronização automática para o cliente."""
    cliente = db.query(Cliente).filter(Cliente.id == id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    cliente.status_ativo = status_update.status_ativo
    db.commit()
    db.refresh(cliente)
    return cliente

@router.delete("/{id}")
def deletar_cliente(id: str, db: Session = Depends(get_db)):
    """Apaga o cliente e todos os seus logs associados."""
    cliente = db.query(Cliente).filter(Cliente.id == id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    # Remove manualmente os logs para manter a integridade caso não haja CASCADE configurado.
    db.query(Log).filter(Log.cliente_id == id).delete()
    
    # Exclui o cliente
    db.delete(cliente)
    db.commit()
    return {"mensagem": "Cliente deletado com sucesso"}

@router.get("/{id}/logs", response_model=List[schemas.LogResponse])
def listar_logs_cliente(id: str, db: Session = Depends(get_db)):
    """Retorna os últimos 50 logs de um cliente, do mais recente para o mais antigo."""
    cliente = db.query(Cliente).filter(Cliente.id == id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
        
    logs = db.query(Log).filter(Log.cliente_id == id).order_by(Log.data_hora.desc()).limit(50).all()
    return logs

@router.post("/{id}/sync-manual")
async def sync_manual_cliente(id: str, db: Session = Depends(get_db)):
    """Aciona uma execução imediata de sincronização (bloqueante)."""
    cliente = db.query(Cliente).filter(Cliente.id == id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
        
    # Executa de forma bloqueante (aguarda o fim do processo)
    sucesso, mensagem = await executar_sync(id, db)
    
    # Retorna o resultado e os logs (STDOUT/STDERR) gerados pelo Rclone
    return {
        "sucesso": sucesso,
        "mensagem": mensagem
    }

@router.get("/{id}/sync-stream")
async def sync_stream_cliente(id: str, db: Session = Depends(get_db)):
    """Inicia a sincronização e retorna os logs em tempo real (Server-Sent Events)."""
    return StreamingResponse(executar_sync_stream(id, db), media_type="text/event-stream")
