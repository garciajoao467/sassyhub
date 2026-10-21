import os
import re
import shutil
import unicodedata
import configparser
from pathlib import Path
from typing import Optional, Tuple, Dict
from sqlalchemy.orm import Session
from models import Configuracao

# Caminhos padrão do projeto Sassy
SERVER_RCLONE_CONF = r"C:\Users\conta\AppData\Roaming\rclone\rclone.conf"
WORKSPACE_BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
WORKSPACE_RCLONE_CONF = WORKSPACE_BASE_DIR / "Programa base" / "Config Rclone" / "rclone.conf"
WORKSPACE_LISTA = WORKSPACE_BASE_DIR / "Programa base" / "Config Rclone" / "lista_clientes.txt"
WORKSPACE_FILTRO = WORKSPACE_BASE_DIR / "Programa base" / "Config Rclone" / "filtrostmp.txt"
WORKSPACE_LOG = WORKSPACE_BASE_DIR / "Programa base" / "Config Rclone" / "log_producao.txt"

PROD_BASE_CLIENT_DIR = r"A:\SASSY SQUARE MARKETING\Clientes Sassy"
PROD_LISTA = r"A:\Config Rclone\lista_clientes.txt"
PROD_FILTRO = r"A:\Config Rclone\filtrostmp.txt"
PROD_LOG = r"A:\Config Rclone\log_producao.txt"


def get_rclone_conf_path(db: Optional[Session] = None) -> str:
    """
    Retorna o caminho do rclone.conf ativo.
    1. Banco de dados (se configurado explicitamente)
    2. Servidor de produção (C:\\Users\\conta\\AppData\\Roaming\\rclone\\rclone.conf)
    3. %APPDATA%\\rclone\\rclone.conf local da máquina atual
    4. Fallback no repositório (Programa base\\Config Rclone\\rclone.conf)
    """
    if db:
        conf_db = db.query(Configuracao).filter(Configuracao.chave == "rclone_conf_path").first()
        if conf_db and conf_db.valor and os.path.exists(conf_db.valor):
            return conf_db.valor

    # Verifica servidor produção
    if os.path.exists(SERVER_RCLONE_CONF):
        return SERVER_RCLONE_CONF

    # Verifica AppData da máquina atual
    appdata = os.environ.get("APPDATA")
    if appdata:
        appdata_conf = os.path.join(appdata, "rclone", "rclone.conf")
        if os.path.exists(appdata_conf):
            return appdata_conf

    # Fallback para o arquivo do repositório
    if os.path.exists(WORKSPACE_RCLONE_CONF):
        return str(WORKSPACE_RCLONE_CONF)

    # Se não existir em nenhum lugar, tenta o caminho padrão do rclone
    return os.path.expandvars(r"%APPDATA%\rclone\rclone.conf")


def get_lista_clientes_path() -> str:
    """Retorna o caminho de lista_clientes.txt (produção A: ou repositório local)."""
    if os.path.exists(PROD_LISTA):
        return PROD_LISTA
    if os.path.exists(WORKSPACE_LISTA):
        return str(WORKSPACE_LISTA)
    return PROD_LISTA


def get_filtro_path() -> str:
    """Retorna o caminho do arquivo de filtros temporários."""
    if os.path.exists(PROD_FILTRO):
        return PROD_FILTRO
    if os.path.exists(WORKSPACE_FILTRO):
        return str(WORKSPACE_FILTRO)
    return PROD_FILTRO


def get_log_producao_path() -> str:
    """Retorna o caminho do arquivo de log unificado."""
    if os.path.exists(PROD_LOG):
        return PROD_LOG
    if os.path.exists(WORKSPACE_LOG):
        return str(WORKSPACE_LOG)
    return str(WORKSPACE_LOG)


def get_base_client_dir(db: Optional[Session] = None) -> str:
    """Retorna o diretório base das pastas dos clientes (A:\\... ou configurado no banco)."""
    if db:
        conf_db = db.query(Configuracao).filter(Configuracao.chave == "base_client_dir").first()
        if conf_db and conf_db.valor:
            return conf_db.valor
    return PROD_BASE_CLIENT_DIR


def gerar_nome_remote(nome_cliente: str) -> str:
    """
    Gera o identificador padronizado de remote do Rclone a partir do nome do cliente.
    Exemplo:
        'Top Notch Builders' -> 'remote_TopNotchBuilders'
        'M&T Bank' -> 'remote_MTBank'
        'Dan\'s Auto Body' -> 'remote_DansAutoBody'
    """
    # Normaliza acentuações
    norm = unicodedata.normalize('NFKD', nome_cliente).encode('ascii', 'ignore').decode('utf-8')
    # Trata apóstrofos e possessivos
    norm = re.sub(r"['’]s\b", "s", norm)
    norm = re.sub(r"['’]", "", norm)
    
    # Extrai grupos alfanuméricos
    palavras = re.findall(r'[a-zA-Z0-9]+', norm)
    if not palavras:
        return "remote_Cliente"

    # Se a palavra for toda em maiúsculas (ex: YMCA, BNI), mantém. Senão capitaliza (PascalCase)
    camel = "".join(p if p.isupper() else p.capitalize() for p in palavras)
    
    return f"remote_{camel}"


def obter_template_drive(conf_path: str) -> Dict[str, str]:
    """
    Extrai automaticamente as credenciais base de OAuth do Google Drive
    (client_id, client_secret, token com refresh_token e scope) a partir de um
    remote drive funcional já configurado no rclone.conf.

    REGRA CRÍTICA: Nunca mistura credenciais de seções diferentes. No protocolo Google OAuth,
    o refresh_token é gerado e assinado especificamente para um determinado client_id/secret.
    Se o token for de uma seção e o client_id for de outra, o Google rejeita com:
    'couldn't fetch token: unauthorized_client'.
    """
    candidatos_arquivos = []
    for p in [conf_path, SERVER_RCLONE_CONF, str(WORKSPACE_RCLONE_CONF)]:
        if p and os.path.exists(p) and p not in candidatos_arquivos:
            candidatos_arquivos.append(p)

    candidatos_remotes = []

    for c_path in candidatos_arquivos:
        cp = configparser.ConfigParser(interpolation=None)
        try:
            cp.read(c_path, encoding='utf-8')
            for sec in cp.sections():
                if cp[sec].get("type") != "drive":
                    continue

                token_val = cp[sec].get("token", "").strip()
                # É indispensável ter um refresh_token para permitir renovação automática
                if "refresh_token" not in token_val:
                    continue

                cid = cp[sec].get("client_id", "").strip()
                csec = cp[sec].get("client_secret", "").strip()
                scope = cp[sec].get("scope", "drive").strip()

                # Pontuação de qualidade do template:
                # - Seção completa com client_id + client_secret + token ganha prioridade máxima (+20)
                # - Remotes reais de produção já ativos (ex: remote_YMCA, remote_TrueBluePaving) ganham bônus (+10)
                # - Desfavorece seções de teste ou o próprio remote genérico (+0)
                score = 0
                if cid and csec:
                    score += 20
                if sec.startswith("remote_") and sec != "remote_Cliente":
                    score += 10
                elif sec.startswith("remote_"):
                    score += 5
                else:
                    score += 1

                candidatos_remotes.append((score, sec, {
                    "type": "drive",
                    "client_id": cid,
                    "client_secret": csec,
                    "scope": scope,
                    "token": token_val,
                }))
        except Exception as e:
            print(f"Aviso ao ler template do rclone.conf ({c_path}): {e}")

    if candidatos_remotes:
        # Escolhe o melhor conjunto atômico
        candidatos_remotes.sort(key=lambda x: x[0], reverse=True)
        melhor = candidatos_remotes[0]
        return melhor[2]

    return {
        "type": "drive",
        "client_id": "",
        "client_secret": "",
        "scope": "drive",
        "token": "",
    }


def verificar_remote_existe(nome_remote: str, conf_path: str) -> bool:
    """Verifica se uma seção com esse nome de remote já existe no rclone.conf."""
    if not os.path.exists(conf_path):
        return False
    cp = configparser.ConfigParser(interpolation=None)
    try:
        cp.read(conf_path, encoding='utf-8')
        return nome_remote in cp.sections()
    except Exception:
        return False


def salvar_ou_atualizar_secao_conf(conf_path: str, nome_remote: str, campos: Dict[str, str]) -> None:
    """
    Salva ou atualiza a seção [nome_remote] no rclone.conf de forma atômica e limpa,
    preservando os comentários, a estrutura e evitando duplicações no arquivo.
    """
    linhas = []
    if os.path.exists(conf_path):
        with open(conf_path, "r", encoding="utf-8") as f:
            linhas = f.readlines()

    novo_bloco = [f"[{nome_remote}]\n"]
    for k, v in campos.items():
        novo_bloco.append(f"{k} = {v}\n")
    novo_bloco.append("\n")

    inicio_sec = -1
    fim_sec = -1
    for i, linha in enumerate(linhas):
        if linha.strip() == f"[{nome_remote}]":
            inicio_sec = i
            fim_sec = len(linhas)
            for j in range(i + 1, len(linhas)):
                if linhas[j].strip().startswith("[") and linhas[j].strip().endswith("]"):
                    fim_sec = j
                    break
            break

    if inicio_sec != -1:
        # Substitui a seção existente sem duplicar
        novas_linhas = linhas[:inicio_sec] + novo_bloco + linhas[fim_sec:]
    else:
        # Adiciona ao final com espaçamento correto
        if linhas and not linhas[-1].endswith("\n"):
            linhas[-1] += "\n"
        if linhas and linhas[-1].strip() != "":
            linhas.append("\n")
        novas_linhas = linhas + novo_bloco

    with open(conf_path, "w", encoding="utf-8") as f:
        f.writelines(novas_linhas)


def criar_remote_rclone(
    nome_remote: str, 
    folder_id: str, 
    db: Optional[Session] = None,
    nome_cliente: Optional[str] = None
) -> Tuple[bool, str, str]:
    """
    Cria ou atualiza uma seção de remote no rclone.conf vinculado ao folder_id do Google Drive.
    Também adiciona a linha de registro em lista_clientes.txt se o arquivo existir.
    
    Retorna: (sucesso: bool, mensagem: str, conf_path_utilizado: str)
    """
    conf_path = get_rclone_conf_path(db)
    
    # Garante que a pasta pai do rclone.conf existe
    os.makedirs(os.path.dirname(os.path.abspath(conf_path)), exist_ok=True)

    # Obtém o template base de credenciais atômicas
    template = obter_template_drive(conf_path)
    if not template.get("token"):
        return False, f"Nenhum remote Google Drive com token OAuth funcional foi encontrado no rclone.conf ({conf_path}).", conf_path

    # Monta os campos de configuração para o remote
    campos = {
        "type": template["type"],
    }
    if template.get("client_id"):
        campos["client_id"] = template["client_id"]
    if template.get("client_secret"):
        campos["client_secret"] = template["client_secret"]
        
    campos["scope"] = template.get("scope", "drive")
    campos["token"] = template["token"]
    campos["team_drive"] = folder_id
    campos["root_folder_id"] = ""

    try:
        salvar_ou_atualizar_secao_conf(conf_path, nome_remote, campos)
    except Exception as e:
        return False, f"Erro ao gravar novo remote em {conf_path}: {e}", conf_path

    # Se estiver no modo de compatibilidade com lista_clientes.txt, registra lá também sem duplicar
    if nome_cliente:
        try:
            lista_path = get_lista_clientes_path()
            if os.path.exists(lista_path):
                with open(lista_path, "r", encoding="utf-8") as f_lista:
                    conteudo = f_lista.read()
                linha_identificador = f"{nome_remote}:"
                if linha_identificador not in conteudo:
                    with open(lista_path, "a", encoding="utf-8") as f_lista:
                        if not conteudo.endswith("\n"):
                            f_lista.write("\n")
                        f_lista.write(f"{nome_cliente};{nome_remote}:\n")
        except Exception as e:
            print(f"Aviso ao registrar em lista_clientes.txt: {e}")

    return True, f"Remote '{nome_remote}' configurado com sucesso em {conf_path}.", conf_path
