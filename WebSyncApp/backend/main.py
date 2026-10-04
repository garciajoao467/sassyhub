import uvicorn
from fastapi import FastAPI
from database import engine, Base
import models

# Cria as tabelas do banco de dados (se não existirem)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="WebSync API",
    description="API para gerenciamento de motor de sincronização Rclone"
)

@app.get("/")
def root():
    return {"status": "ok", "mensagem": "WebSync API online! Banco de dados inicializado com sucesso."}

if __name__ == "__main__":
    # Inicia o servidor de desenvolvimento na porta padrão (8000)
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
