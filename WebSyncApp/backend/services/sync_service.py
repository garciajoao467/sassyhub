import asyncio
import shutil
import sys
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
        #"--dry-run",
        "--filter-from", filtro_path,
        "--track-renames",
        "--drive-chunk-size", "128M",
        "--transfers", "8",
        "--checkers", "16",
        "--log-level", "NOTICE"
    ]

    try:
        import subprocess
        import sys
        
        def run_subprocess():
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT, # Juntamos stderr no stdout
                text=True,
                bufsize=1,
                universal_newlines=True,
                encoding='utf-8',
                errors='replace'
            )
            linhas = []
            with open(log_path, "a", encoding="utf-8") as f_log:
                for line in process.stdout:
                    sys.stdout.write(line)
                    sys.stdout.flush()
                    linhas.append(line)
                    # Grava no log de producao mas filtra os stats do rclone
                    if not any(k in line for k in ["Transferred:", "Elapsed time:", "Transfers:", "Checks:", "Deleted:", "Renamed:"]):
                        f_log.write(line)
                        f_log.flush()
                
            process.wait()
            return process.returncode, linhas
            
        return_code, linhas = await asyncio.to_thread(run_subprocess)
        
        status_sucesso = (return_code == 0)
        
        # Junta a mensagem para os logs
        if status_sucesso:
            mensagem = f"[OK] Cliente {cliente.nome} sincronizado perfeitamente."
        else:
            # Extrai a linha de erro real do rclone
            linha_erro = ""
            for l in reversed(linhas):
                if "ERROR :" in l or "Failed to" in l:
                    linha_erro = l.strip()
                    break
            
            if not linha_erro and len(linhas) > 0:
                linha_erro = linhas[-1].strip()
                
            mensagem = f"[!] Falha ao sincronizar {cliente.nome}.\nMotivo: {linha_erro}"
        
        # Registra o resultado na tabela de Logs
        novo_log = Log(
            cliente_id=cliente.id,
            status_sucesso=status_sucesso,
            mensagem=mensagem
        )
        db.add(novo_log)
        
        # Desativa o auto-sync em caso de erro fatal
        if not status_sucesso:
            cliente.status_ativo = False
            
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
        
        # Desativa o cliente
        cliente.status_ativo = False
        
        db.commit()
        
        return False, mensagem_erro

async def executar_sync_stream(cliente_id: str, db: Session):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        yield f"data: Cliente com ID {cliente_id} não encontrado.\n\n"
        return

    rclone_path = shutil.which("rclone")
    if not rclone_path:
        yield "data: Executável do Rclone não encontrado no PATH do sistema.\n\n"
        return

    filtro_path = r"A:\Config Rclone\filtrostmp.txt"
    log_path = r"A:\Config Rclone\log_producao.txt"
    
    # Removemos o --log-file para capturar o output e usamos --progress / --verbose
    cmd = [
        rclone_path,
        "bisync",
        cliente.pasta_origem,
        cliente.pasta_destino,
        "--force",
        ##"--dry-run",
        "--filter-from", filtro_path,
        "--track-renames",
        "--drive-chunk-size", "128M",
        "--transfers", "8",
        "--checkers", "16",
        "--log-level", "NOTICE",
        "--stats=1s"
    ]

    loop = asyncio.get_running_loop()
    q = asyncio.Queue()

    def run_subprocess():
        import subprocess
        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                text=True,
                bufsize=1,
                universal_newlines=True,
                encoding='utf-8',
                errors='replace'
            )
            for line in process.stdout:
                loop.call_soon_threadsafe(q.put_nowait, line)
            process.wait()
            loop.call_soon_threadsafe(q.put_nowait, ("DONE", process.returncode))
        except Exception as e:
            loop.call_soon_threadsafe(q.put_nowait, ("ERROR", str(e)))

    # Inicia a thread
    asyncio.create_task(asyncio.to_thread(run_subprocess))

    linhas_completas = []
    return_code = -1
    
    while True:
        item = await q.get()
        if isinstance(item, tuple):
            if item[0] == "DONE":
                return_code = item[1]
                break
            elif item[0] == "ERROR":
                yield f"data: ERRO FATAL: {item[1]}\n\n"
                return_code = -1
                break
        else:
            linhas_completas.append(item)
            # Imprime no terminal da API para vizualizacao local
            sys.stdout.write(item)
            sys.stdout.flush()
            
            # Grava no arquivo original de logs
            with open(log_path, "a", encoding="utf-8") as f_log:
                if not any(k in item for k in ["Transferred:", "Elapsed time:", "Transfers:", "Checks:", "Deleted:", "Renamed:"]):
                    f_log.write(item)
            
            linha_sse = item.replace('\n', '')
            yield f"data: {linha_sse}\n\n"

    status_sucesso = (return_code == 0)
    
    if status_sucesso:
        mensagem_final = f"[OK] Cliente {cliente.nome} sincronizado perfeitamente."
    else:
        # Extrai a linha de erro real do rclone
        linha_erro = ""
        for l in reversed(linhas_completas):
            if "ERROR :" in l or "Failed to" in l:
                linha_erro = l.strip()
                break
        
        if not linha_erro and len(linhas_completas) > 0:
            linha_erro = linhas_completas[-1].strip()
            
        mensagem_final = f"[!] Falha ao sincronizar {cliente.nome}.\nMotivo: {linha_erro}"
    
    # Registra no banco ao final
    novo_log = Log(
        cliente_id=cliente.id,
        status_sucesso=status_sucesso,
        mensagem=mensagem_final
    )
    db.add(novo_log)
    
    if not status_sucesso:
        cliente.status_ativo = False
        
    db.commit()
    
    if status_sucesso:
        yield "data: [SYNC_CONCLUIDO] Sucesso!\n\n"
    else:
        yield f"data: [SYNC_ERRO] Processo finalizado com código de erro {return_code}.\n\n"
