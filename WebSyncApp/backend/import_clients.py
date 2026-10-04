import os
import sys

# Garante que as importações locais funcionem
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
from models import Cliente, Base

# Garante que as tabelas existem antes de importar
Base.metadata.create_all(bind=engine)


# Base dir conforme os arquivos .bat
BASE_DIR = r"A:\SASSY SQUARE MARKETING\Clientes Sassy\\"
LIST_PATH = r"c:\Users\herdg\OneDrive\Documentos\Ssy\Programa base\Config Rclone\lista_clientes.txt"

def import_clients():
    db = SessionLocal()
    print("Lendo arquivo de configuração original...")
    try:
        with open(LIST_PATH, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                parts = line.split(';')
                if len(parts) == 2:
                    nome = parts[0].strip()
                    destino = parts[1].strip()
                    
                    # Constrói o caminho completo da origem
                    origem = f"{BASE_DIR}{nome}"
                    
                    # Verifica se o cliente já existe para evitar duplicatas
                    existing = db.query(Cliente).filter(Cliente.nome == nome).first()
                    if not existing:
                        novo_cliente = Cliente(
                            nome=nome,
                            pasta_origem=origem,
                            pasta_destino=destino,
                            status_ativo=True
                        )
                        db.add(novo_cliente)
                        print(f"[+] Inserido: {nome} (Origem: {origem} | Destino: {destino})")
                    else:
                        print(f"[-] Ignorado (Já existe): {nome}")
        db.commit()
        print("Importação finalizada com sucesso!")
    except Exception as e:
        print(f"Erro ao importar: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    import_clients()
