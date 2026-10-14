from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

# Base schema para reaproveitamento
class ClienteBase(BaseModel):
    nome: str
    pasta_origem: str
    pasta_destino: str
    status_ativo: bool = True

# Modelo para a criação (POST)
class ClienteCreate(ClienteBase):
    pass

# Modelo para atualização completa/parcial (PUT)
class ClienteUpdate(BaseModel):
    nome: Optional[str] = None
    pasta_origem: Optional[str] = None
    pasta_destino: Optional[str] = None
    status_ativo: Optional[bool] = None

# Modelo focado apenas na ativação/desativação (PATCH)
class ClienteStatusUpdate(BaseModel):
    status_ativo: bool

# Modelo de resposta do Cliente (GET)
class ClienteResponse(ClienteBase):
    id: str
    criado_em: datetime
    ultimo_sync: Optional[datetime] = None

    # Permite que o Pydantic leia diretamente dos atributos do objeto SQLAlchemy
    model_config = ConfigDict(from_attributes=True)

# Modelo de resposta dos Logs (GET)
class LogResponse(BaseModel):
    id: str
    cliente_id: str
    data_hora: datetime
    status_sucesso: bool
    mensagem: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# Modelo para Onboarding de Novo Cliente (criação de remote + registro)
class ClienteOnboardRequest(BaseModel):
    nome: str
    pasta_id: str
    pasta_origem: Optional[str] = None
    nome_remote: Optional[str] = None
    status_ativo: bool = True
    iniciar_carga_zero: bool = True

class ClienteOnboardResponse(BaseModel):
    cliente: ClienteResponse
    remote_nome: str
    rclone_conf_path: str
    mensagem: str
