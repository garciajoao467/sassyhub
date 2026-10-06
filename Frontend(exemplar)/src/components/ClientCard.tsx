import React, { useState } from 'react';
import {
  Play,
  Terminal,
  MoreVertical,
  Edit2,
  Trash2,
  RotateCw,
  Clock,
  GripVertical,
} from 'lucide-react';
import { SyncClient } from '../types';

interface ClientCardProps {
  client: SyncClient;
  onToggleAutoSync: (id: string, currentState: boolean) => void;
  onForceSync: (id: string) => void;
  onViewLogs: (client: SyncClient) => void;
  onEdit: (client: SyncClient) => void;
  onDelete: (id: string, name: string) => void;
  isSyncingNow?: boolean;
  onDragStart?: (id: string) => void;
}

export const ClientCard: React.FC<ClientCardProps> = ({
  client,
  onToggleAutoSync,
  onForceSync,
  onViewLogs,
  onEdit,
  onDelete,
  isSyncingNow = false,
  onDragStart,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const isActuallySyncing = client.status === 'syncing' || isSyncingNow;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', client.id);
        onDragStart?.(client.id);
      }}
      className={`group relative flex flex-col justify-between rounded-2xl bg-[#14131c] border transition-all duration-200 p-4.5 cursor-grab active:cursor-grabbing ${
        isActuallySyncing
          ? 'border-[#b886fd] bg-[#181624] ring-1 ring-[#b886fd]/40 shadow-xl shadow-purple-950/30'
          : client.status === 'error'
          ? 'border-rose-500/50 bg-[#161218]'
          : client.autoSync
          ? 'border-[#2d293f] hover:border-[#b886fd]/70 shadow-md shadow-black/40'
          : 'border-[#22202c] opacity-85 hover:opacity-100 hover:border-[#3c3752]'
      }`}
    >
      <div>
        {/* Top Header inside Card */}
        <div className="flex items-start justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Grip handle */}
            <div
              className="text-[#646175] group-hover:text-[#b886fd] p-0.5 rounded transition-colors shrink-0"
              title="Arraste para mover entre Ativos e Inativos"
            >
              <GripVertical className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-extrabold text-white tracking-tight truncate group-hover:text-[#d8b4fe] transition-colors">
                {client.name}
              </h3>
              
              {/* Unboxed Metadata (Status + Intervalo) */}
              <div className="flex items-center gap-2 text-xs text-[#9d9aa8] mt-0.5">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isActuallySyncing
                        ? 'bg-[#b886fd] animate-pulse'
                        : client.status === 'synced'
                        ? 'bg-emerald-400'
                        : client.status === 'error'
                        ? 'bg-rose-400'
                        : 'bg-[#5c596d]'
                    }`}
                  />
                  <span className="text-slate-200 font-semibold text-[11px]">
                    {isActuallySyncing
                      ? 'Sincronizando...'
                      : client.status === 'synced'
                      ? 'Sincronizado'
                      : client.status === 'error'
                      ? 'Erro de Rede'
                      : 'Pausado'}
                  </span>
                </span>
                <span className="text-[#454256]">·</span>
                <span className="font-mono text-[#8a8698] tabular-nums text-[11px]">
                  {client.intervalMinutes === 0 ? 'Tempo Real' : `A cada ${client.intervalMinutes}m`}
                </span>
              </div>
            </div>
          </div>

          {/* Context Options */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-lg text-[#7c788d] hover:text-white hover:bg-[#201e2c] transition-colors cursor-pointer"
              title="Opções"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-7 z-30 w-36 rounded-xl bg-[#1b1926] border border-[#3b364e] shadow-2xl py-1 backdrop-blur-xl animate-in fade-in zoom-in-95">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(client);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-200 hover:text-white hover:bg-[#272437] transition-colors text-left cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[#b886fd]" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(client.id, client.name);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors text-left cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Excluir</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Progress Bar (Aprovada: Visual Sassy Lavender) */}
        {isActuallySyncing && (
          <div className="mb-3.5 p-2.5 rounded-xl bg-[#1b172a] border border-[#a855f7]/40 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-[#d8b4fe] flex items-center gap-1.5 text-[11px]">
                <RotateCw className="w-3 h-3 animate-spin text-[#b886fd]" />
                Sincronizando arquivos...
              </span>
              <span className="font-mono font-bold text-white tabular-nums text-[11px]">
                {client.stats.progressPercent || 74}% · {client.stats.speedMbps || 36.2} MB/s
              </span>
            </div>
            <div className="w-full h-2 bg-[#12111a] rounded-full overflow-hidden p-[1px] border border-[#2f2b42]">
              <div
                className="h-full bg-gradient-to-r from-[#8b5cf6] via-[#a855f7] to-[#c084fc] transition-all duration-300 rounded-full shadow-sm shadow-purple-500/50"
                style={{ width: `${client.stats.progressPercent || 74}%` }}
              />
            </div>
          </div>
        )}

        {/* Last Sync Timestamp */}
        <div className="flex items-center justify-between text-[11px] text-[#7c788c] mb-3 pt-1 border-t border-[#232030]">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-[#b886fd]" /> Último ciclo:
          </span>
          <span className="font-mono text-slate-300 tabular-nums">
            {client.lastSyncAt
              ? new Date(client.lastSyncAt).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Pendente'}
          </span>
        </div>
      </div>

      {/* Card Actions Bottom Row */}
      <div className="pt-2.5 border-t border-[#232030] flex items-center justify-between gap-2">
        {/* Toggle Switch */}
        <label
          className="flex items-center gap-2 cursor-pointer select-none group/switch"
          title={client.autoSync ? 'Auto-sync ativo' : 'Auto-sync pausado'}
        >
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              checked={client.autoSync}
              onChange={() => onToggleAutoSync(client.id, client.autoSync)}
              className="sr-only"
            />
            {/* Switch Track with Sassy lavender fill */}
            <div
              className={`w-8 h-4.5 rounded-full transition-colors duration-200 ease-in-out ${
                client.autoSync
                  ? 'bg-[#b886fd] shadow-sm shadow-purple-900/50'
                  : 'bg-[#23212f] border border-[#353246]'
              }`}
            />
            {/* Switch Knob */}
            <div
              className={`absolute left-0.5 top-0.5 w-3.5 h-3.5 rounded-full transition-transform duration-200 ease-in-out shadow-sm ${
                client.autoSync ? 'translate-x-3.5 bg-black' : 'translate-x-0 bg-white'
              }`}
            />
          </div>
          <span className="text-[11px] font-bold text-slate-300 group-hover/switch:text-white transition-colors">
            {client.autoSync ? 'Ativo' : 'Pausado'}
          </span>
        </label>

        {/* Buttons: Forçar Sync + Ver Logs */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onForceSync(client.id)}
            disabled={isActuallySyncing}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all duration-200 cursor-pointer ${
              isActuallySyncing
                ? 'bg-[#241f36] border-[#a855f7]/40 text-[#d8b4fe] opacity-60'
                : 'bg-[#1b1926] hover:bg-[#252236] text-slate-200 hover:text-white border-[#2e2a40] hover:border-[#b886fd]/60 active:scale-95'
            }`}
            title="Forçar sincronização imediata"
          >
            {isActuallySyncing ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin text-[#b886fd]" />
            ) : (
              <Play className="w-3.5 h-3.5 text-[#b886fd] fill-[#b886fd]" />
            )}
            <span>Forçar</span>
          </button>

          <button
            onClick={() => onViewLogs(client)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-[#1b1926] hover:bg-[#252236] text-slate-200 hover:text-white border border-[#2e2a40] hover:border-[#b886fd]/60 transition-all duration-200 active:scale-95 cursor-pointer"
            title="Ver histórico de logs no terminal"
          >
            <Terminal className="w-3.5 h-3.5 text-[#b886fd]" />
            <span>Logs</span>
          </button>
        </div>
      </div>
    </div>
  );
};
