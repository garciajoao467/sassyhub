import asyncio
import shutil
from sqlalchemy.orm import Session
from models import Cliente, Log

async def executar_sync(cliente_id: str, db: Session):
    # Busca o cliente no banco de dados
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    
    if not cliente:
        return False, f"Cliente com ID {cliente_id} não encontrado."

    # Prepara o comando do Rclone
    rclone_path = shutil.which("rclone")
    if not rclone_path:
        return False, "Executável do Rclone não encontrado no PATH do sistema."

    # Caminhos fixos de configuração da Sassy
    filtro_path = r"A:\Config Rclone\filtrostmp.txt"
    log_path = r"A:\Config Rclone\log_producao.txt"

    # Montando a lista exata do script de produção
    cmd = [
        rclone_path,
        "bisync",
        cliente.pasta_origem,
        cliente.pasta_destino,
        "--force",
        "--filter-from", filtro_path,
        "--track-renames",
        "--drive-chunk-size", "128M",
        "--transfers", "8",
        "--checkers", "16",
        "--log-file", log_path,
        "--log-level", "NOTICE"
    ]

    try:
        # Invoca o Rclone de forma não bloqueante (stdin=DEVNULL previne travamento em caso de prompt)
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Aguarda a conclusão do processo e captura a saída
        stdout, stderr = await process.communicate()
        
        return_code = process.returncode
        status_sucesso = (return_code == 0)
        
        # Decodifica stdout e stderr (com fallback caso encontre caracteres não mapeados)
        out_str = stdout.decode('utf-8', errors='replace').strip() if stdout else ""
        err_str = stderr.decode('utf-8', errors='replace').strip() if stderr else ""
        
        # Junta a mensagem para os logs
        mensagem = ""
        if out_str:
            mensagem += f"STDOUT:\n{out_str}\n"
        if err_str:
            mensagem += f"STDERR:\n{err_str}"
            
        if not mensagem:
            mensagem = "Nenhuma saída gerada pelo Rclone na interface (gravado no log_producao.txt)."
        
        # Registra o resultado na tabela de Logs
        novo_log = Log(
            cliente_id=cliente.id,
            status_sucesso=status_sucesso,
            mensagem=mensagem
        )
        db.add(novo_log)
        db.commit()
        
        return status_sucesso, mensagem

    except Exception as e:
        mensagem_erro = f"Erro inesperado ao executar o subprocesso Rclone: {repr(e)}"
        
        # Registra a falha no banco de dados
        novo_log = Log(
            cliente_id=cliente.id,
            status_sucesso=False,
            mensagem=mensagem_erro
        )
        db.add(novo_log)
        db.commit()
        
        return False, mensagem_erro
