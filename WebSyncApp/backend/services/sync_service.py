import asyncio
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models import Cliente, Log
from services.rclone_service import get_filtro_path, get_log_producao_path, get_rclone_conf_path


async def stream_command(cmd: list, log_path: str):
    """Executa um comando rclone transmitindo cada linha e o código final."""
    loop = asyncio.get_running_loop()
    q = asyncio.Queue()

    def worker():
        try:
            proc = subprocess.Popen(
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
            for line in proc.stdout:
                loop.call_soon_threadsafe(q.put_nowait, line)
            proc.wait()
            loop.call_soon_threadsafe(q.put_nowait, ("DONE", proc.returncode))
        except Exception as e:
            loop.call_soon_threadsafe(q.put_nowait, ("ERROR", str(e)))

    asyncio.create_task(asyncio.to_thread(worker))

    while True:
        item = await q.get()
        if isinstance(item, tuple):
            yield item  # ("DONE", returncode) ou ("ERROR", err_msg)
            break
        else:
            sys.stdout.write(item)
            sys.stdout.flush()
            try:
                os.makedirs(os.path.dirname(os.path.abspath(log_path)), exist_ok=True)
                with open(log_path, "a", encoding="utf-8") as f_log:
                    f_log.write(item)
            except Exception:
                pass
            yield ("LINE", item)


async def executar_sync(cliente_id: str, db: Session):
    # Busca o cliente no banco de dados
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    
    if not cliente:
        return False, f"Cliente com ID {cliente_id} não encontrado."

    # Prepara o comando do Rclone
    rclone_path = shutil.which("rclone")
    if not rclone_path:
        return False, "Executável do Rclone não encontrado no PATH do sistema."

    filtro_path = get_filtro_path()
    log_path = get_log_producao_path()
    conf_path = get_rclone_conf_path(db)

    cmd = [
        rclone_path,
        "bisync",
        cliente.pasta_origem,
        cliente.pasta_destino,
        "--force",
        "--track-renames",
        "--drive-chunk-size", "128M",
        "--transfers", "8",
        "--checkers", "16",
        "--log-level", "NOTICE"
    ]

    if conf_path and os.path.exists(conf_path):
        cmd.extend(["--config", conf_path])

    if filtro_path and os.path.exists(filtro_path):
        cmd.extend(["--filter-from", filtro_path])

    try:
        def run_subprocess():
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True,
                encoding='utf-8',
                errors='replace'
            )
            linhas = []
            try:
                os.makedirs(os.path.dirname(os.path.abspath(log_path)), exist_ok=True)
                with open(log_path, "a", encoding="utf-8") as f_log:
                    for line in process.stdout:
                        sys.stdout.write(line)
                        sys.stdout.flush()
                        linhas.append(line)
                        if not any(k in line for k in ["Transferred:", "Elapsed time:", "Transfers:", "Checks:", "Deleted:", "Renamed:"]):
                            f_log.write(line)
                            f_log.flush()
            except Exception:
                for line in process.stdout:
                    linhas.append(line)

            process.wait()
            return process.returncode, linhas

        return_code, linhas = await asyncio.to_thread(run_subprocess)
        status_sucesso = (return_code == 0)

        if status_sucesso:
            mensagem = f"[OK] Cliente {cliente.nome} sincronizado perfeitamente."
        else:
            linha_erro = ""
            for l in reversed(linhas):
                if "ERROR :" in l or "Failed to" in l:
                    linha_erro = l.strip()
                    break
            if not linha_erro and len(linhas) > 0:
                linha_erro = linhas[-1].strip()
            mensagem = f"[!] Falha ao sincronizar {cliente.nome}.\nMotivo: {linha_erro}"

        novo_log = Log(
            cliente_id=cliente.id,
            status_sucesso=status_sucesso,
            mensagem=mensagem
        )
        db.add(novo_log)

        # Não desativamos status_ativo ao falhar: o cliente deve continuar na fila
        # para tentar novamente nos próximos ciclos automáticos.
        cliente.ultimo_sync = datetime.now(timezone.utc)
        try:
            db.commit()
        except Exception:
            db.rollback()
            raise

        return status_sucesso, mensagem

    except Exception as e:
        mensagem_erro = f"Erro inesperado ao executar o subprocesso Rclone: {repr(e)}"
        try:
            novo_log = Log(
                cliente_id=cliente.id,
                status_sucesso=False,
                mensagem=mensagem_erro
            )
            db.add(novo_log)
            cliente.ultimo_sync = datetime.now(timezone.utc)
            db.commit()
        except Exception:
            db.rollback()
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

    filtro_path = get_filtro_path()
    log_path = get_log_producao_path()
    conf_path = get_rclone_conf_path(db)

    cmd = [
        rclone_path,
        "bisync",
        cliente.pasta_origem,
        cliente.pasta_destino,
        "--force",
        "--track-renames",
        "--drive-chunk-size", "128M",
        "--transfers", "8",
        "--checkers", "16",
        "--log-level", "NOTICE",
        "--stats=1s"
    ]

    if conf_path and os.path.exists(conf_path):
        cmd.extend(["--config", conf_path])

    if filtro_path and os.path.exists(filtro_path):
        cmd.extend(["--filter-from", filtro_path])

    loop = asyncio.get_running_loop()
    q = asyncio.Queue()

    def run_subprocess():
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
            sys.stdout.write(item)
            sys.stdout.flush()

            try:
                os.makedirs(os.path.dirname(os.path.abspath(log_path)), exist_ok=True)
                with open(log_path, "a", encoding="utf-8") as f_log:
                    if not any(k in item for k in ["Transferred:", "Elapsed time:", "Transfers:", "Checks:", "Deleted:", "Renamed:"]):
                        f_log.write(item)
            except Exception:
                pass

            linha_sse = item.replace('\n', '')
            yield f"data: {linha_sse}\n\n"

    status_sucesso = (return_code == 0)

    if status_sucesso:
        mensagem_final = f"[OK] Cliente {cliente.nome} sincronizado perfeitamente."
    else:
        linha_erro = ""
        for l in reversed(linhas_completas):
            if "ERROR :" in l or "Failed to" in l:
                linha_erro = l.strip()
                break
        if not linha_erro and len(linhas_completas) > 0:
            linha_erro = linhas_completas[-1].strip()
        mensagem_final = f"[!] Falha ao sincronizar {cliente.nome}.\nMotivo: {linha_erro}"

    novo_log = Log(
        cliente_id=cliente.id,
        status_sucesso=status_sucesso,
        mensagem=mensagem_final
    )
    db.add(novo_log)

    cliente.ultimo_sync = datetime.now(timezone.utc)
    try:
        db.commit()
    except Exception:
        db.rollback()

    if status_sucesso:
        yield "data: [SYNC_CONCLUIDO] Sucesso!\n\n"
    else:
        yield f"data: [SYNC_ERRO] Processo finalizado com código de erro {return_code}.\n\n"


async def executar_carga_zero_stream(cliente_id: str, db: Session):
    """
    Executa o Marco Zero (Carga Inicial) exatamente como em incial.bat:
      Passo 1/3: rclone copy <origem> <destino> (sobe exclusivos do PC para nuvem)
      Passo 2/3: rclone copy <destino> <origem> (baixa exclusivos da nuvem para PC)
      Passo 3/3: rclone bisync <origem> <destino> --resync (consolida o Marco Zero bidirecional)
    """
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        yield f"data: [CARGA_ZERO_ERRO] Cliente com ID {cliente_id} não encontrado.\n\n"
        return

    rclone_path = shutil.which("rclone")
    if not rclone_path:
        yield "data: [CARGA_ZERO_ERRO] Executável do Rclone não encontrado no PATH do sistema.\n\n"
        return

    filtro_path = get_filtro_path()
    log_path = get_log_producao_path()
    conf_path = get_rclone_conf_path(db)

    # Argumentos comuns para todas as etapas da carga zero
    base_args = [
        "--checkers", "16",
        "--transfers", "8",
        "--drive-chunk-size", "128M",
        "--progress",
        "--log-level", "NOTICE"
    ]
    if conf_path and os.path.exists(conf_path):
        base_args.extend(["--config", conf_path])
    if filtro_path and os.path.exists(filtro_path):
        base_args.extend(["--filter-from", filtro_path])

    yield f"data: ===================================================\n\n"
    yield f"data: [MARCO ZERO] Iniciando Inicialização de: {cliente.nome}\n\n"
    yield f"data: Origem (PC): {cliente.pasta_origem}\n\n"
    yield f"data: Destino (Google Drive): {cliente.pasta_destino}\n\n"
    yield f"data: ===================================================\n\n"

    # PASSO 1: Upload (PC -> Nuvem)
    yield "data: [ETAPA 1/3] Subindo arquivos exclusivos do servidor local para a nuvem...\n\n"
    cmd1 = [rclone_path, "copy", cliente.pasta_origem, cliente.pasta_destino] + base_args
    code1 = -1
    async for tipo, conteudo in stream_command(cmd1, log_path):
        if tipo == "LINE":
            clean = conteudo.replace("\n", "")
            yield f"data: {clean}\n\n"
        elif tipo == "DONE":
            code1 = conteudo
        elif tipo == "ERROR":
            yield f"data: ERRO: {conteudo}\n\n"
            code1 = -1

    if code1 != 0:
        msg = f"[!] Falha no Passo 1 (Upload Local -> Nuvem) para {cliente.nome}."
        novo_log = Log(cliente_id=cliente.id, status_sucesso=False, mensagem=msg)
        db.add(novo_log)
        cliente.status_ativo = False
        db.commit()
        yield f"data: [CARGA_ZERO_ERRO] {msg}\n\n"
        return

    # PASSO 2: Download (Nuvem -> PC)
    yield "data: [ETAPA 2/3] Baixando arquivos exclusivos da nuvem para o servidor local...\n\n"
    cmd2 = [rclone_path, "copy", cliente.pasta_destino, cliente.pasta_origem] + base_args
    code2 = -1
    async for tipo, conteudo in stream_command(cmd2, log_path):
        if tipo == "LINE":
            clean = conteudo.replace("\n", "")
            yield f"data: {clean}\n\n"
        elif tipo == "DONE":
            code2 = conteudo
        elif tipo == "ERROR":
            yield f"data: ERRO: {conteudo}\n\n"
            code2 = -1

    if code2 != 0:
        msg = f"[!] Falha no Passo 2 (Download Nuvem -> Local) para {cliente.nome}."
        novo_log = Log(cliente_id=cliente.id, status_sucesso=False, mensagem=msg)
        db.add(novo_log)
        cliente.status_ativo = False
        db.commit()
        yield f"data: [CARGA_ZERO_ERRO] {msg}\n\n"
        return

    # PASSO 3: Bisync Marco Zero com --resync
    yield "data: [ETAPA 3/3] Consolidando o Marco Zero Bidirecional (rclone bisync --resync)...\n\n"
    cmd3 = [rclone_path, "bisync", cliente.pasta_origem, cliente.pasta_destino, "--resync"] + base_args
    code3 = -1
    async for tipo, conteudo in stream_command(cmd3, log_path):
        if tipo == "LINE":
            clean = conteudo.replace("\n", "")
            yield f"data: {clean}\n\n"
        elif tipo == "DONE":
            code3 = conteudo
        elif tipo == "ERROR":
            yield f"data: ERRO: {conteudo}\n\n"
            code3 = -1

    if code3 != 0:
        msg = f"[!] Falha no Passo 3 (Marco Zero Bisync) para {cliente.nome}."
        novo_log = Log(cliente_id=cliente.id, status_sucesso=False, mensagem=msg)
        db.add(novo_log)
        cliente.status_ativo = False
        db.commit()
        yield f"data: [CARGA_ZERO_ERRO] {msg}\n\n"
        return

    # Sucesso total nas 3 etapas!
    msg_sucesso = f"[OK] Carga Zero e Marco Zero concluídos com sucesso para {cliente.nome}! Cliente ativo e sincronizado."
    novo_log = Log(cliente_id=cliente.id, status_sucesso=True, mensagem=msg_sucesso)
    db.add(novo_log)
    cliente.status_ativo = True
    cliente.ultimo_sync = datetime.now(timezone.utc)
    db.commit()

    yield f"data: ===================================================\n\n"
    yield f"data: [CARGA_ZERO_CONCLUIDO] {msg_sucesso}\n\n"
    yield f"data: ===================================================\n\n"
