import React, { useState } from 'react';
import { SyncClient } from '../types';
import { ClientCard } from './ClientCard';
import { ArrowRightLeft, PauseCircle, CheckCircle2 } from 'lucide-react';

interface ClientKanbanBoardProps {
  clients: SyncClient[];
  onToggleAutoSync: (id: string, currentState: boolean) => void;
  onForceSync: (id: string) => void;
  onViewLogs: (client: SyncClient) => void;
  onEdit: (client: SyncClient) => void;
  onDelete: (id: string, name: string) => void;
  syncingIds: Set<string>;
  onMoveClient: (clientId: string, targetAutoSync: boolean) => void;
  onPauseAll: () => void;
  onResumeAll: () => void;
}

export const ClientKanbanBoard: React.FC<ClientKanbanBoardProps> = ({
  clients,
  onToggleAutoSync,
  onForceSync,
  onViewLogs,
  onEdit,
  onDelete,
  syncingIds,
  onMoveClient,
  onPauseAll,
  onResumeAll,
}) => {
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<'active' | 'inactive' | null>(null);

  const activeClients = clients.filter((c) => c.autoSync);
  const inactiveClients = clients.filter((c) => !c.autoSync);

  const handleDragStart = (id: string) => {
    setDraggedClientId(id);
  };

  const handleDragOver = (e: React.DragEvent, column: 'active' | 'inactive') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== column) {
      setDragOverColumn(column);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetAutoSync: boolean) => {
    e.preventDefault();
    setDragOverColumn(null);
    const clientId = e.dataTransfer.getData('text/plain') || draggedClientId;
    if (clientId) {
      onMoveClient(clientId, targetAutoSync);
    }
    setDraggedClientId(null);
  };

  return (
    <div className="space-y-4">
      {/* Two-Column Drag & Drop Board */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        
        {/* COLUMN 1: CLIENTES ATIVOS */}
        <div
          onDragOver={(e) => handleDragOver(e, 'active')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, true)}
          className={`rounded-2xl transition-all duration-200 p-4 border flex flex-col min-h-[500px] ${
            dragOverColumn === 'active'
              ? 'bg-[#181525] border-[#b886fd] ring-2 ring-[#b886fd]/40 shadow-2xl shadow-purple-950/40'
              : 'bg-[#100f17] border-[#242131]'
          }`}
        >
          {/* Column Header */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#211f2e]">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#b886fd] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#b886fd]"></span>
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                  Clientes Ativos
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#221a36] text-[#b886fd] border border-[#a855f7]/30">
                    {activeClients.length}
                  </span>
                </h2>
                <span className="text-[11px] text-[#787586]">
                  Monitoramento contínuo em background
                </span>
              </div>
            </div>

            {activeClients.length > 0 && (
              <button
                onClick={onPauseAll}
                className="px-2.5 py-1 text-[11px] font-bold text-[#9d9aa8] hover:text-white hover:bg-[#1e1c2b] border border-[#2d2a3d] rounded-lg transition-colors cursor-pointer"
                title="Pausar todos os clientes ativos"
              >
                Pausar Todos
              </button>
            )}
          </div>

          {/* Cards or Empty Drop Zone */}
          {activeClients.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-[#2b273d] bg-[#14121d]/50 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#211a36] flex items-center justify-center text-[#b886fd] mb-2">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-white">Nenhum cliente ativo no momento</p>
              <p className="text-[11px] text-[#797686] mt-1 max-w-xs">
                Arraste um cliente da coluna de pausados para cá para ligar a sincronização automática.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeClients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onToggleAutoSync={onToggleAutoSync}
                  onForceSync={onForceSync}
                  onViewLogs={onViewLogs}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isSyncingNow={syncingIds.has(client.id)}
                  onDragStart={handleDragStart}
                />
              ))}
            </div>
          )}
        </div>

        {/* COLUMN 2: CLIENTES INATIVOS / PAUSADOS */}
        <div
          onDragOver={(e) => handleDragOver(e, 'inactive')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, false)}
          className={`rounded-2xl transition-all duration-200 p-4 border flex flex-col min-h-[500px] ${
            dragOverColumn === 'inactive'
              ? 'bg-[#181525] border-[#b886fd] ring-2 ring-[#b886fd]/40 shadow-2xl shadow-purple-950/40'
              : 'bg-[#100f17] border-[#242131]'
          }`}
        >
          {/* Column Header */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#211f2e]">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#524f62] inline-block" />
              <div>
                <h2 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                  Clientes Inativos / Pausados
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#1d1b26] text-[#8e8a9d] border border-[#2e2a3c]">
                    {inactiveClients.length}
                  </span>
                </h2>
                <span className="text-[11px] text-[#787586]">
                  Auto-sync desligado · standby manual
                </span>
              </div>
            </div>

            {inactiveClients.length > 0 && (
              <button
                onClick={onResumeAll}
                className="px-2.5 py-1 text-[11px] font-bold text-[#b886fd] hover:text-[#d8b4fe] hover:bg-[#211a36] border border-[#a855f7]/40 rounded-lg transition-colors cursor-pointer"
                title="Ativar sincronização de todos os inativos"
              >
                Ativar Todos
              </button>
            )}
          </div>

          {/* Cards or Empty Drop Zone */}
          {inactiveClients.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-[#2b273d] bg-[#14121d]/50 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#1a1824] flex items-center justify-center text-[#787586] mb-2">
                <PauseCircle className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-white">Todos os clientes estão ativos</p>
              <p className="text-[11px] text-[#797686] mt-1 max-w-xs">
                Arraste um cliente para cá se desejar suspender temporariamente o agendamento em background.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {inactiveClients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onToggleAutoSync={onToggleAutoSync}
                  onForceSync={onForceSync}
                  onViewLogs={onViewLogs}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isSyncingNow={syncingIds.has(client.id)}
                  onDragStart={handleDragStart}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
