import React from 'react';
import { SyncClient } from '../types';
import {
  Folder,
  Cloud,
  HardDrive,
  Play,
  Terminal,
  Edit2,
  Trash2,
  RotateCw,
} from 'lucide-react';

interface ClientTableViewProps {
  clients: SyncClient[];
  onToggleAutoSync: (id: string, currentState: boolean) => void;
  onForceSync: (id: string) => void;
  onViewLogs: (client: SyncClient) => void;
  onEdit: (client: SyncClient) => void;
  onDelete: (id: string, name: string) => void;
  syncingIds: Set<string>;
}

export const ClientTableView: React.FC<ClientTableViewProps> = ({
  clients,
  onToggleAutoSync,
  onForceSync,
  onViewLogs,
  onEdit,
  onDelete,
  syncingIds,
}) => {
  return (
    <div className="overflow-x-auto rounded-2xl border border-purple-900/60 bg-[#120a24]/60 backdrop-blur-md">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-purple-900/60 bg-[#0c0818]/60 text-purple-300 font-bold uppercase tracking-wider text-[11px]">
            <th className="py-3 px-4">Cliente</th>
            <th className="py-3 px-4">Caminhos (Origem &rarr; Destino)</th>
            <th className="py-3 px-4">Auto-Sync</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4 text-right">Última Sync</th>
            <th className="py-3 px-4 text-center">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-purple-900/40 text-purple-100">
          {clients.map((client) => {
            const isSyncing = client.status === 'syncing' || syncingIds.has(client.id);

            return (
              <tr
                key={client.id}
                className="hover:bg-purple-950/40 transition-colors group"
              >
                <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                  {client.name}
                </td>

                <td className="py-3.5 px-4 max-w-xs truncate font-mono text-[11px] text-purple-300">
                  <div className="flex items-center gap-1.5 truncate">
                    <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate text-slate-200" title={client.sourcePath}>
                      {client.sourcePath}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate mt-1">
                    <Cloud className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                    <span className="truncate text-purple-300" title={client.destinationPath}>
                      {client.destinationPath}
                    </span>
                  </div>
                </td>

                <td className="py-3.5 px-4 whitespace-nowrap">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={client.autoSync}
                      onChange={() => onToggleAutoSync(client.id, client.autoSync)}
                      className="sr-only"
                    />
                    <div
                      className={`w-8 h-4.5 rounded-full transition-colors ${
                        client.autoSync
                          ? 'bg-gradient-to-r from-pink-500 to-amber-400 shadow-sm'
                          : 'bg-purple-950 border border-purple-800'
                      }`}
                    />
                    <div
                      className={`absolute left-0.5 top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                        client.autoSync ? 'translate-x-3.5' : 'translate-x-0'
                      }`}
                    />
                  </label>
                </td>

                <td className="py-3.5 px-4 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSyncing
                          ? 'bg-amber-400 animate-pulse'
                          : client.status === 'synced'
                          ? 'bg-emerald-400'
                          : client.status === 'error'
                          ? 'bg-pink-500'
                          : 'bg-purple-500'
                      }`}
                    />
                    <span className="text-slate-200">
                      {isSyncing
                        ? 'Sincronizando...'
                        : client.status === 'synced'
                        ? 'Sincronizado'
                        : client.status === 'error'
                        ? 'Falha / Erro'
                        : 'Pausado'}
                    </span>
                  </span>
                </td>

                <td className="py-3.5 px-4 text-right font-mono tabular-nums text-purple-300 whitespace-nowrap">
                  {client.lastSyncAt
                    ? new Date(client.lastSyncAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </td>

                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => onForceSync(client.id)}
                      disabled={isSyncing}
                      className="p-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 text-amber-300 transition-colors cursor-pointer"
                      title="Forçar Sincronização"
                    >
                      {isSyncing ? (
                        <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-pink-400 text-pink-400" />
                      )}
                    </button>

                    <button
                      onClick={() => onViewLogs(client)}
                      className="p-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 text-purple-200 hover:text-white transition-colors cursor-pointer"
                      title="Ver Logs"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onEdit(client)}
                      className="p-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 text-purple-200 hover:text-white transition-colors cursor-pointer"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onDelete(client.id, client.name)}
                      className="p-1.5 rounded-lg bg-purple-950/80 hover:bg-pink-950 text-pink-400 transition-colors cursor-pointer"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
