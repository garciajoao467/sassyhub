import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import Log, Cliente

def check_latest_log():
    db = SessionLocal()
    try:
        latest_log = db.query(Log).order_by(Log.data_hora.desc()).first()
        if latest_log:
            cliente = db.query(Cliente).filter(Cliente.id == latest_log.cliente_id).first()
            nome_cliente = cliente.nome if cliente else "Desconhecido"
            
            print(f"--- ÚLTIMO LOG DE SINCRONIZAÇÃO ---")
            print(f"Cliente: {nome_cliente} (ID: {latest_log.cliente_id})")
            print(f"Status de Sucesso: {latest_log.status_sucesso}")
            print(f"Data e Hora: {latest_log.data_hora}")
            print(f"Mensagem/Output do Rclone:\n{latest_log.mensagem}")
        else:
            print("Nenhum log encontrado na base de dados.")
    except Exception as e:
        print(f"Erro ao buscar logs: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_latest_log()
