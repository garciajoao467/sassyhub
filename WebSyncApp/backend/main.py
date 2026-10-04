import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from database import engine, Base
import models
from scheduler import scheduler
from routers import clientes

# Cria as tabelas do banco de dados (se não existirem)
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Inicia o agendador de tarefas em background
    scheduler.start()
    yield
    # Shutdown: Encerra o agendador suavemente ao desligar o servidor
    scheduler.shutdown()

app = FastAPI(
    title="WebSync API",
    description="API para gerenciamento de motor de sincronização Rclone",
    lifespan=lifespan
)

# Registrar os roteadores (routers)
app.include_router(clientes.router)

@app.get("/")
def root():
    return {
        "status": "ok", 
        "mensagem": "WebSync API online! Motor de sync e agendamento em background ativos."
    }

if __name__ == "__main__":
    # Inicia o servidor de desenvolvimento na porta padrão (8000)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
