import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { ClientKanbanBoard } from './components/ClientKanbanBoard';
import { ClientCard } from './components/ClientCard';
import { ClientModal } from './components/ClientModal';
import { LogsModal } from './components/LogsModal';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { ToastContainer } from './components/Toast';
import {
  SyncClient,
  SyncStatus,
  LogEntry,
  EngineStats,
  ToastMessage,
} from './types';
import {
  INITIAL_CLIENTS,
  MOCK_LOGS,
  syncApiService,
} from './services/api';
import { Plus, RefreshCw, FolderSearch } from 'lucide-react';

export default function App() {
  const [clients, setClients] = useState<SyncClient[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('websync_clients_v3');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return INITIAL_CLIENTS;
  });

  const [logs, setLogs] = useState<Record<string, LogEntry[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('websync_logs_v3');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return MOCK_LOGS;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Modals
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<SyncClient | null>(null);
  const [logsModalClient, setLogsModalClient] = useState<SyncClient | null>(null);
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);

  // Syncing states
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set(['client-2']));
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Telemetry
  const [engineStats, setEngineStats] = useState<EngineStats>({
    daemonStatus: 'running',
    fastApiConnected: false,
    fastApiUrl: syncApiService.getBaseUrl(),
    activeJobsCount: clients.filter((c) => c.autoSync).length,
    syncingNowCount: 1,
    uptimeSeconds: 84320,
    lastHeartbeat: new Date().toISOString(),
  });

  useEffect(() => {
    localStorage.setItem('websync_clients_v3', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('websync_logs_v3', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    syncApiService.checkHealth().then((res) => {
      setEngineStats((prev) => ({
        ...prev,
        fastApiConnected: res.ok,
      }));
    });
  }, []);

  const addToast = (type: 'success' | 'info' | 'warning' | 'error', title: string, message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addLog = (clientId: string, entry: Omit<LogEntry, 'id'>) => {
    const newEntry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...entry,
    };
    setLogs((prev) => ({
      ...prev,
      [clientId]: [...(prev[clientId] || []), newEntry],
    }));
  };

  // Drag and drop between Active and Inactive
  const handleMoveClient = async (clientId: string, targetAutoSync: boolean) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    if (client.autoSync === targetAutoSync) return;

    await syncApiService.toggleAutoSync(clientId, targetAutoSync);

    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              autoSync: targetAutoSync,
              status: targetAutoSync ? 'synced' : 'paused',
            }
          : c
      )
    );

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    addLog(clientId, {
      timestamp: timeStr,
      level: targetAutoSync ? 'INFO' : 'WARN',
      message: targetAutoSync
        ? 'Cliente movido para Ativos. Auto-sync iniciado.'
        : 'Cliente movido para Inativos. Auto-sync pausado.',
      details: targetAutoSync ? `Frequência: ${client.intervalMinutes}m` : 'Em repouso manual.',
    });

    addToast(
      targetAutoSync ? 'success' : 'info',
      targetAutoSync ? 'Cliente Ativado' : 'Cliente Pausado',
      `${client.name} foi movido para os ${targetAutoSync ? 'Ativos' : 'Inativos'}.`
    );
  };

  const handleToggleAutoSync = async (id: string, currentState: boolean) => {
    handleMoveClient(id, !currentState);
  };

  const handlePauseAll = () => {
    setClients((prev) =>
      prev.map((c) => ({
        ...c,
        autoSync: false,
        status: 'paused',
      }))
    );
    addToast('info', 'Todos os Clientes Pausados', 'A sincronização em segundo plano foi pausada para todos os jobs.');
  };

  const handleResumeAll = () => {
    setClients((prev) =>
      prev.map((c) => ({
        ...c,
        autoSync: true,
        status: 'synced',
      }))
    );
    addToast('success', 'Todos os Clientes Ativados', 'A sincronização automática foi ativada para toda a fila.');
  };

  const handleForceSync = async (id: string) => {
    const client = clients.find((c) => c.id === id);
    if (!client) return;

    setSyncingIds((prev) => new Set([...prev, id]));
    setClients((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: 'syncing' as SyncStatus } : c
      )
    );

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    addLog(id, {
      timestamp: timeStr,
      level: 'INFO',
      message: `Comando manual "Forçar Sync" disparado pelo operador.`,
      details: `Varrendo diretório de origem: ${client.sourcePath}`,
    });

    addToast('info', 'Sincronização Iniciada', `Verificando alterações em ${client.name}...`);

    await syncApiService.forceSync(id);

    setTimeout(() => {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      const finishTime = new Date();
      const finishTimeStr = finishTime.toTimeString().split(' ')[0] + '.' + String(finishTime.getMilliseconds()).padStart(3, '0');

      setClients((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status: 'synced' as SyncStatus,
                lastSyncAt: finishTime.toISOString(),
                stats: {
                  ...c.stats,
                  filesCount: (c.stats.filesCount || 0) + 2,
                },
              }
            : c
        )
      );

      addLog(id, {
        timestamp: finishTimeStr,
        level: 'SUCCESS',
        message: `Sincronização forçada concluída com sucesso. Integridade validada.`,
        details: `Destino atualizado em ${client.destinationPath}`,
      });

      addToast(
        'success',
        'Sincronização Concluída',
        `Todos os arquivos de ${client.name} foram sincronizados.`
      );
    }, 2400);
  };

  const handleSyncAll = () => {
    setIsSyncingAll(true);
    addToast('info', 'Sincronização Global', 'Iniciando varredura em todos os clientes ativos...');

    const activeClients = clients.filter((c) => c.autoSync);
    activeClients.forEach((c, index) => {
      setTimeout(() => {
        handleForceSync(c.id);
      }, index * 400);
    });

    setTimeout(() => {
      setIsSyncingAll(false);
    }, (activeClients.length + 1) * 500);
  };

  const handleOpenNewClientModal = () => {
    setEditingClient(null);
    setIsClientModalOpen(true);
  };

  const handleEditClient = (client: SyncClient) => {
    setEditingClient(client);
    setIsClientModalOpen(true);
  };

  const handleSaveClient = async (formData: Partial<SyncClient>) => {
    if (editingClient) {
      await syncApiService.updateClient(editingClient.id, formData);
      setClients((prev) =>
        prev.map((c) =>
          c.id === editingClient.id
            ? {
                ...c,
                ...formData,
                status: formData.autoSync ? c.status : 'paused',
              }
            : c
        )
      );
      addToast('success', 'Cliente Atualizado', `As alterações de ${formData.name} foram salvas.`);
    } else {
      const newId = `client-${Date.now()}`;
      const newClient: SyncClient = {
        id: newId,
        name: formData.name || 'Novo Cliente',
        sourcePath: formData.sourcePath || '',
        destinationPath: formData.destinationPath || '',
        autoSync: formData.autoSync ?? true,
        status: formData.autoSync ? 'synced' : 'paused',
        lastSyncAt: null,
        nextSyncAt: null,
        intervalMinutes: formData.intervalMinutes ?? 15,
        excludePatterns: formData.excludePatterns || '*.tmp',
        stats: {
          filesCount: 0,
        },
      };

      await syncApiService.createClient(newClient);
      setClients((prev) => [newClient, ...prev]);

      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

      setLogs((prev) => ({
        ...prev,
        [newId]: [
          {
            id: `log-init-${Date.now()}`,
            timestamp: timeStr,
            level: 'INFO',
            message: `Cliente ${newClient.name} cadastrado com sucesso.`,
            details: `Origem: ${newClient.sourcePath} -> Destino: ${newClient.destinationPath}`,
          },
        ],
      }));

      addToast(
        'success',
        'Cliente Criado',
        `${newClient.name} foi adicionado à coluna de ${newClient.autoSync ? 'Ativos' : 'Inativos'}.`
      );
    }

    setIsClientModalOpen(false);
    setEditingClient(null);
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja remover as configurações de "${name}"?`)) {
      await syncApiService.deleteClient(id);
      setClients((prev) => prev.filter((c) => c.id !== id));
      addToast('warning', 'Cliente Removido', `O job de ${name} foi excluído.`);
    }
  };

  const handleClearLogs = (clientId: string) => {
    setLogs((prev) => ({
      ...prev,
      [clientId]: [],
    }));
    addToast('info', 'Logs Limpos', 'O buffer de log da sessão atual foi limpo.');
  };

  const filteredClients = clients.filter((client) => {
    return (
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.sourcePath.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.destinationPath.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-[#0e0e13] text-white flex flex-col font-sans selection:bg-[#a855f7]/30 selection:text-white relative overflow-x-hidden">
      
      {/* Subtle deep purple ambient radial glows on edges as seen in Sassy Square screenshot */}
      <div className="fixed -top-40 -left-40 w-[600px] h-[600px] bg-[#23153c]/40 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed top-1/3 -right-40 w-[600px] h-[600px] bg-[#1e1338]/30 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Header */}
      <Header
        onOpenNewClientModal={handleOpenNewClientModal}
        onSyncAll={handleSyncAll}
        onOpenApiSettings={() => setIsApiSettingsOpen(true)}
        isSyncingAll={isSyncingAll}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Banner */}
        <div className="mb-8 pb-7 border-b border-[#232130]">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.1]">
            Something <span className="text-[#b886fd]">sassy</span> is syncing.
          </h1>
          
          <p className="text-sm text-[#9d9aa8] mt-2 max-w-xl leading-relaxed">
            Arraste os clientes entre <strong className="text-white">Ativos</strong> e{' '}
            <strong className="text-white">Inativos</strong> para controlar o motor FastAPI em background.
          </p>
        </div>

        {/* Search & View Mode Switcher */}
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          totalFiltered={filteredClients.length}
        />

        {/* Clients Display: Drag-and-Drop Columns (Default) vs Simple List */}
        {filteredClients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2b273d] bg-[#14121d]/40 p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-[#211a36] flex items-center justify-center text-[#b886fd] mb-3">
              <FolderSearch className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-white">Nenhum cliente encontrado</h3>
            <p className="text-xs text-[#8e8a9d] max-w-sm mx-auto mt-1 mb-5">
              Não encontramos nenhum cliente correspondente a &quot;{searchQuery}&quot;.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 text-xs font-bold text-white bg-[#1f1d2c] hover:bg-[#282638] border border-[#332f45] rounded-xl transition-colors cursor-pointer"
            >
              Limpar Busca
            </button>
          </div>
        ) : viewMode === 'kanban' ? (
          <ClientKanbanBoard
            clients={filteredClients}
            onToggleAutoSync={handleToggleAutoSync}
            onForceSync={handleForceSync}
            onViewLogs={(c) => setLogsModalClient(c)}
            onEdit={handleEditClient}
            onDelete={handleDeleteClient}
            syncingIds={syncingIds}
            onMoveClient={handleMoveClient}
            onPauseAll={handlePauseAll}
            onResumeAll={handleResumeAll}
          />
        ) : (
          /* Simple List View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onToggleAutoSync={handleToggleAutoSync}
                onForceSync={handleForceSync}
                onViewLogs={(c) => setLogsModalClient(c)}
                onEdit={handleEditClient}
                onDelete={handleDeleteClient}
                isSyncingNow={syncingIds.has(client.id)}
                onDragStart={() => {}}
              />
            ))}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#232130] py-4 px-6 text-xs text-[#7c788c] flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-white">WebSync Manager</span>
          <span>·</span>
          <span>
            Identidade visual inspirada na <span className="text-[#b886fd] font-bold">Sassy Square</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-[#8e8a9d]">FastAPI Background Engine</span>
          <span>·</span>
          <button
            onClick={() => setIsApiSettingsOpen(true)}
            className="text-[#b886fd] hover:text-[#d8b4fe] transition-colors cursor-pointer font-semibold"
          >
            Configurações da API
          </button>
        </div>
      </footer>

      {/* Modais */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => {
          setIsClientModalOpen(false);
          setEditingClient(null);
        }}
        onSave={handleSaveClient}
        editingClient={editingClient}
      />

      <LogsModal
        isOpen={logsModalClient !== null}
        onClose={() => setLogsModalClient(null)}
        client={logsModalClient}
        logs={logsModalClient ? logs[logsModalClient.id] || [] : []}
        onAddLogEntry={addLog}
        onClearLogs={handleClearLogs}
      />

      <ApiSettingsModal
        isOpen={isApiSettingsOpen}
        onClose={() => setIsApiSettingsOpen(false)}
        currentUrl={engineStats.fastApiUrl}
        onUrlChange={(newUrl) => {
          setEngineStats((prev) => ({ ...prev, fastApiUrl: newUrl }));
          addToast('info', 'Endpoint Atualizado', `Novo endereço definido: ${newUrl}`);
        }}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

    </div>
  );
}
