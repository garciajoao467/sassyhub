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


try:
    from dotenv import load_dotenv
    # Carrega .env do diretório backend se existir
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass


def obter_template_drive(conf_path: str) -> Dict[str, str]:
    """
    Lê variáveis de ambiente (.env) ou arquivos rclone.conf existentes para
    extrair as credenciais base de OAuth do Google Drive (client_id, client_secret, token com refresh_token).
    """
    template = {
        "type": "drive",
        "client_id": os.environ.get("RCLONE_DRIVE_CLIENT_ID", ""),
        "client_secret": os.environ.get("RCLONE_DRIVE_CLIENT_SECRET", ""),
        "scope": "drive",
        "token": os.environ.get("RCLONE_DRIVE_TOKEN", ""),
    }

    # Se já tivermos client_id e token completo das variáveis de ambiente / .env, usamos direto
    if template["client_id"] and template["token"]:
        return template

    # Busca em cascata nos arquivos rclone.conf disponíveis (conf ativo, workspace base e servidor)
    candidatos = [conf_path, str(WORKSPACE_RCLONE_CONF), SERVER_RCLONE_CONF]
    for c_path in candidatos:
        if not c_path or not os.path.exists(c_path):
            continue

        cp = configparser.ConfigParser(interpolation=None)
        try:
            cp.read(c_path, encoding='utf-8')
            for sec in cp.sections():
                if cp[sec].get("type") == "drive" and cp[sec].get("token"):
                    token_val = cp[sec].get("token", "")
                    if "refresh_token" in token_val:
                        if not template["client_id"]:
                            template["client_id"] = cp[sec].get("client_id", "")
                        if not template["client_secret"]:
                            template["client_secret"] = cp[sec].get("client_secret", "")
                        template["scope"] = cp[sec].get("scope", "drive")
                        if not template["token"]:
                            template["token"] = token_val

                        # Se obtivemos um token válido e client_id, podemos retornar
                        if template["token"] and template["client_id"]:
                            return template
        except Exception as e:
            print(f"Aviso ao ler template do rclone.conf ({c_path}): {e}")

    return template


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


def criar_remote_rclone(
    nome_remote: str, 
    folder_id: str, 
    db: Optional[Session] = None,
    nome_cliente: Optional[str] = None
) -> Tuple[bool, str, str]:
    """
    Cria uma nova seção de remote no rclone.conf vinculado ao folder_id do Google Drive.
    Também adiciona a linha de registro em lista_clientes.txt se o arquivo existir.
    
    Retorna: (sucesso: bool, mensagem: str, conf_path_utilizado: str)
    """
    conf_path = get_rclone_conf_path(db)
    
    # Garante que a pasta pai do rclone.conf existe
    os.makedirs(os.path.dirname(os.path.abspath(conf_path)), exist_ok=True)

    # Verifica se já existe
    if verificar_remote_existe(nome_remote, conf_path):
        return False, f"O remote '{nome_remote}' já existe no arquivo rclone.conf ({conf_path}).", conf_path

    # Obtém o template base de credenciais
    template = obter_template_drive(conf_path)

    bloco_novo = (
        f"\n[{nome_remote}]\n"
        f"type = {template['type']}\n"
        f"client_id = {template['client_id']}\n"
        f"client_secret = {template['client_secret']}\n"
        f"scope = {template['scope']}\n"
        f"token = {template['token']}\n"
        f"team_drive = {folder_id}\n"
        f"root_folder_id = \n"
    )

    try:
        # Grava de forma segura no rclone.conf
        with open(conf_path, "a", encoding="utf-8") as f:
            f.write(bloco_novo)
    except Exception as e:
        return False, f"Erro ao gravar novo remote em {conf_path}: {e}", conf_path

    # Se estiver no modo de compatibilidade com lista_clientes.txt, registra lá também
    if nome_cliente:
        try:
            lista_path = get_lista_clientes_path()
            if os.path.exists(lista_path):
                with open(lista_path, "a", encoding="utf-8") as f_lista:
                    f_lista.write(f"\n{nome_cliente};{nome_remote}:")
        except Exception as e:
            print(f"Aviso ao registrar em lista_clientes.txt: {e}")

    return True, f"Remote '{nome_remote}' criado com sucesso em {conf_path}.", conf_path
