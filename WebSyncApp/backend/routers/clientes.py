from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from database import get_db
import schemas
from models import Cliente, Log
from scheduler import rotina_diaria_sync
from services.sync_service import executar_sync, executar_sync_stream, executar_carga_zero_stream
from services.rclone_service import (
    criar_remote_rclone,
    gerar_nome_remote,
    get_base_client_dir,
    get_rclone_conf_path,
    verificar_remote_existe
)

router = APIRouter(prefix="/api/clientes", tags=["Clientes"])


@router.get("/", response_model=List[schemas.ClienteResponse])
def listar_clientes(db: Session = Depends(get_db)):
    """Lista todos os clientes."""
    clientes = db.query(Cliente).all()
    return clientes

@router.get("/preview-remote")
def preview_remote(nome: str = Query(...), db: Session = Depends(get_db)):
    """Retorna a sugestão de nome de remote e caminho de origem com base no nome do cliente."""
    remote_nome = gerar_nome_remote(nome)
    base_dir = get_base_client_dir(db)
    pasta_origem_sugerida = os.path.join(base_dir, nome)
    conf_path = get_rclone_conf_path(db)
    existe = verificar_remote_existe(remote_nome, conf_path)
    
    return {
        "remote_nome": remote_nome,
        "pasta_destino_sugerida": f"{remote_nome}:",
        "pasta_origem_sugerida": pasta_origem_sugerida,
        "remote_ja_existe": existe,
        "rclone_conf_path": conf_path
    }

@router.post("/onboard", response_model=schemas.ClienteOnboardResponse)
def onboard_novo_cliente(dados: schemas.ClienteOnboardRequest, db: Session = Depends(get_db)):
    """
    Cadastra um novo cliente no sistema:
      1. Cria a seção de remote no rclone.conf herdando as credenciais Google Drive.
      2. Vincula o ID da pasta informada ao remote criado.
      3. Registra o cliente na base com as pastas de origem e destino configuradas.
    """
    if not dados.nome.strip():
        raise HTTPException(status_code=400, detail="O nome do cliente é obrigatório.")
    if not dados.pasta_id.strip():
        raise HTTPException(status_code=400, detail="O ID da pasta do Google Drive é obrigatório.")

    # Gera ou utiliza o nome de remote informado
    remote_nome = dados.nome_remote.strip() if dados.nome_remote else gerar_nome_remote(dados.nome)
    if not remote_nome.startswith("remote_"):
        remote_nome = f"remote_{remote_nome}"

    # Define o caminho de origem
    base_dir = get_base_client_dir(db)
    pasta_origem = dados.pasta_origem.strip() if dados.pasta_origem else os.path.join(base_dir, dados.nome)
    pasta_destino = f"{remote_nome}:"

    # Verifica se já existe cliente cadastrado com esse nome
    cliente_existente = db.query(Cliente).filter(Cliente.nome == dados.nome.strip()).first()
    if cliente_existente:
        raise HTTPException(status_code=400, detail=f"Já existe um cliente cadastrado com o nome '{dados.nome}'.")

    # 1. Cria o remote no rclone.conf
    sucesso_remote, msg_remote, conf_utilizado = criar_remote_rclone(
        nome_remote=remote_nome,
        folder_id=dados.pasta_id.strip(),
        db=db,
        nome_cliente=dados.nome.strip()
    )

    if not sucesso_remote:
        # Se falhou porque já existe, mas o cliente quer reaproveitar, podemos aceitar caso seja mesmo ID
        if "já existe" not in msg_remote.lower():
            raise HTTPException(status_code=500, detail=f"Falha ao configurar Rclone: {msg_remote}")

    # 2. Cria o registro no banco de dados
    # Se iniciar_carga_zero for True, deixa inicialmente como False para ser ativado ao final da carga zero com sucesso
    novo_cliente = Cliente(
        nome=dados.nome.strip(),
        pasta_origem=pasta_origem,
        pasta_destino=pasta_destino,
        status_ativo=False if dados.iniciar_carga_zero else dados.status_ativo
    )
    db.add(novo_cliente)
    db.commit()
    db.refresh(novo_cliente)

    return schemas.ClienteOnboardResponse(
        cliente=novo_cliente,
        remote_nome=remote_nome,
        rclone_conf_path=conf_utilizado,
        mensagem=f"Remote '{remote_nome}' configurado e cliente registrado com sucesso."
    )

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

@router.get("/{id}/carga-zero-stream")
async def carga_zero_stream_cliente(id: str, db: Session = Depends(get_db)):
    """
    Executa a rotina de Marco Zero (Carga Inicial em 3 etapas) transmitindo logs em tempo real:
      1. Upload (PC -> Google Drive)
      2. Download de verificação (Google Drive -> PC)
      3. Bisync --resync
    Ao concluir com sucesso, ativa o cliente automaticamente na fila de produção.
    """
    return StreamingResponse(executar_carga_zero_stream(id, db), media_type="text/event-stream")
