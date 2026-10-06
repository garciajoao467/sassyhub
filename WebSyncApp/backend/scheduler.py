import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from database import SessionLocal
from models import Cliente
from services.sync_service import executar_sync

# Configuração básica de logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("WebSync.Scheduler")

# Instância do agendador
scheduler = AsyncIOScheduler()

async def sync_cliente_wrapper(cliente_id: str):
    """
    Função auxiliar para garantir que cada cliente sincronizado obtenha sua 
    própria sessão de banco de dados, sendo safe para concorrência e tarefas assíncronas.
    """
    db = SessionLocal()
    try:
        sucesso, msg = await executar_sync(cliente_id, db)
        if sucesso:
            logger.info(f"Sync concluído com sucesso para o cliente ID: {cliente_id}")
        else:
            logger.error(f"Falha no sync para o cliente ID: {cliente_id}. Detalhes: {msg}")
    finally:
        db.close()

async def rotina_diaria_sync():
    """
    Busca todos os clientes ativos e invoca a função de sincronização em background.
    """
    logger.info("Iniciando rotina de sincronização de clientes...")
    db = SessionLocal()
    try:
        # Pega apenas os clientes onde status_ativo é True
        clientes_ativos = db.query(Cliente).filter(Cliente.status_ativo == True).all()
        # Coleta apenas os IDs para passar pra rotina paralela sem travar a sessão aqui
        cliente_ids = [c.id for c in clientes_ativos]
    finally:
        db.close()
        
    if not cliente_ids:
        logger.info("Nenhum cliente ativo no momento. Rotina finalizada.")
        return

    # Executa o sync de cada cliente sequencialmente (exatamente como o .bat original)
    # Isso impede que dezenas de instâncias do rclone consumam toda a CPU/Rede ao mesmo tempo.
    for cid in cliente_ids:
        await sync_cliente_wrapper(cid)
    
    logger.info("Rotina de sincronização de clientes finalizada.")

    logger.info("Rotina de sincronização de clientes finalizada.")

def atualizar_agendamento():
    from models import Configuracao
    db = SessionLocal()
    try:
        mode_conf = db.query(Configuracao).filter(Configuracao.chave == "sync_mode").first()
        val_conf = db.query(Configuracao).filter(Configuracao.chave == "sync_value").first()
        
        mode = mode_conf.valor if mode_conf else "cron"
        value = val_conf.valor if val_conf else "02:00"
        
        # Remove job anterior se existir
        if scheduler.get_job('job_sync'):
            scheduler.remove_job('job_sync')
            
        if mode == "cron":
            # Formato esperado: "HH:MM"
            hora, minuto = value.split(":")
            scheduler.add_job(rotina_diaria_sync, 'cron', hour=int(hora), minute=int(minuto), id='job_sync')
            logger.info(f"Agendamento atualizado para CRON diário às {value}.")
        elif mode == "interval":
            # Formato esperado: X (horas)
            horas = int(value)
            scheduler.add_job(rotina_diaria_sync, 'interval', hours=horas, id='job_sync')
            logger.info(f"Agendamento atualizado para INTERVALO a cada {horas} hora(s).")
    except Exception as e:
        logger.error(f"Falha ao atualizar agendamento: {e}")
        # Fallback de segurança
        if not scheduler.get_job('job_sync'):
            scheduler.add_job(rotina_diaria_sync, 'cron', hour=2, minute=0, id='job_sync')
    finally:
        db.close()

# Configura o job com os valores iniciais do banco (ou fallback)
atualizar_agendamento()
