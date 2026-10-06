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
        "--log-file", log_path,
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
            for line in process.stdout:
                # Imprime no terminal em tempo real!
                sys.stdout.write(line)
                sys.stdout.flush()
                linhas.append(line)
                
            process.wait()
            return process.returncode, "".join(linhas)
            
        return_code, out_str = await asyncio.to_thread(run_subprocess)
        
        status_sucesso = (return_code == 0)
        err_str = "" # Já capturado no out_str
        
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
        "--verbose",
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
            
            linha_sse = item.replace('\n', '')
            yield f"data: {linha_sse}\n\n"

    status_sucesso = (return_code == 0)
    mensagem_final = "".join(linhas_completas)
    
    # Registra no banco ao final
    novo_log = Log(
        cliente_id=cliente.id,
        status_sucesso=status_sucesso,
        mensagem=mensagem_final if mensagem_final else "Sincronização concluída sem output."
    )
    db.add(novo_log)
    db.commit()
    
    if status_sucesso:
        yield "data: [SYNC_CONCLUIDO] Sucesso!\n\n"
    else:
        yield f"data: [SYNC_ERRO] Processo finalizado com código de erro {return_code}.\n\n"
