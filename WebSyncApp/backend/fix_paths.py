import os
import sys

# Garante que as importações locais funcionem
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import Cliente

def fix_paths():
    db = SessionLocal()
    try:
        clientes = db.query(Cliente).all()
        fixed = 0
        for cliente in clientes:
            # Substitui barra dupla (\\) por barra simples (\)
            if "\\\\" in cliente.pasta_origem:
                cliente.pasta_origem = cliente.pasta_origem.replace("\\\\", "\\")
                fixed += 1
        
        db.commit()
        print(f"[{fixed}] registros corrigidos no banco de dados com sucesso!")
    except Exception as e:
        print(f"Erro ao corrigir paths: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_paths()
