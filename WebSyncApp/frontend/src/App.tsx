import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { ClientKanbanBoard } from './components/ClientKanbanBoard';
import { ClientCard } from './components/ClientCard';
import { ClientModal } from './components/ClientModal';
import { LogsModal } from './components/LogsModal';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import { ScheduleModal } from './components/ScheduleModal';
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
import { Plus, RefreshCw, FolderSearch, AlertCircle } from 'lucide-react';

export default function App() {
  const [clients, setClients] = useState<SyncClient[]>([]);

  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Modals
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<SyncClient | null>(null);
  const [logsModalClient, setLogsModalClient] = useState<SyncClient | null>(null);
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set([]));
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  useEffect(() => {
    if (logsModalClient) {
      syncApiService.getLogs(logsModalClient.id).then(data => {
        setLogs(prev => ({ ...prev, [logsModalClient.id]: data }));
      });
    }
  }, [logsModalClient]);

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
    let isMounted = true;

    const checkAndFetch = async () => {
      const health = await syncApiService.checkHealth();
      if (!isMounted) return;

      setEngineStats((prev) => ({
        ...prev,
        fastApiConnected: health.ok,
      }));

      if (health.ok) {
        const data = await syncApiService.getClients();
        if (isMounted && data && data.length > 0) {
          // Atualiza preservando clientes que estão em sincronização ativa no frontend
          setClients((prev) => {
            if (prev.length === 0) return data;
            return data.map((fetchedClient) => {
              const existing = prev.find((p) => p.id === fetchedClient.id);
              if (existing && existing.status === 'syncing') {
                return { ...fetchedClient, status: 'syncing' };
              }
              return fetchedClient;
            });
          });
        }
      }
    };

    checkAndFetch();
    const interval = setInterval(checkAndFetch, 8000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
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

    const salvou = await syncApiService.toggleAutoSync(clientId, targetAutoSync);
    if (!salvou) {
      addToast(
        'error',
        'Erro ao Salvar Status',
        `Não foi possível salvar a alteração de ${client.name} no banco de dados. Verifique a conexão com o servidor backend.`
      );
      return;
    }

    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
            ...c,
            autoSync: targetAutoSync,
            status: targetAutoSync ? (c.status === 'paused' ? 'synced' : c.status) : 'paused',
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
    clients.forEach((c) => {
      if (c.autoSync) {
        syncApiService.toggleAutoSync(c.id, false).catch(() => {});
      }
    });

    setClients((prev) =>
      prev.map((c) => ({
        ...c,
        autoSync: false,
        status: 'paused',
      }))
    );
    addToast('info', 'Todos os Clientes Pausados', 'A sincronização em segundo plano foi pausada para todos os clientes ativos.');
  };

  const handleResumeAll = () => {
    clients.forEach((c) => {
      if (!c.autoSync) {
        syncApiService.toggleAutoSync(c.id, true).catch(() => {});
      }
    });

    setClients((prev) =>
      prev.map((c) => ({
        ...c,
        autoSync: true,
        status: 'synced',
      }))
    );
    addToast('success', 'Todos os Clientes Ativados', 'A sincronização automática foi ativada para toda a fila.');
  };

  const handleForceSync = (id: string) => {
    const client = clients.find((c) => c.id === id);
    if (!client) return;

    setSyncingIds((prev) => new Set([...prev, id]));
    setClients((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: 'syncing' as SyncStatus, stats: { ...c.stats, progressPercent: 0, speedMbps: 0 } } : c
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

    syncApiService.forceSyncStream(
      id,
      (percent, speedStr) => {
        const speedNum = speedStr ? parseFloat(speedStr) : 0;
        setClients((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                ...c,
                stats: {
                  ...c.stats,
                  progressPercent: percent,
                  speedMbps: speedNum > 0 ? speedNum : c.stats.speedMbps,
                },
              }
              : c
          )
        );
      },
      (logEntry) => {
        setLogs((prev) => ({
          ...prev,
          [id]: [...(prev[id] || []), logEntry],
        }));
      },
      (success, errorMsg) => {
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
                status: (success ? 'synced' : 'error') as SyncStatus,
                autoSync: c.autoSync,
                lastSyncAt: finishTime.toISOString(),
                stats: {
                  ...c.stats,
                  progressPercent: 100,
                },
              }
              : c
          )
        );

        addLog(id, {
          timestamp: finishTimeStr,
          level: success ? 'SUCCESS' : 'ERROR',
          message: success ? `Sincronização forçada concluída com sucesso. Integridade validada.` : (errorMsg || `Sincronização finalizada com erros.`),
          details: `Destino: ${client.destinationPath}`,
        });

        addToast(
          success ? 'success' : 'error',
          success ? 'Sincronização Concluída' : 'Erro na Sincronização',
          success ? `Todos os arquivos de ${client.name} foram sincronizados.` : (errorMsg || `Houve uma falha ao sincronizar ${client.name}.`)
        );
      }
    );
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
      try {
        await syncApiService.updateClient(editingClient.id, formData);
        setClients((prev) =>
          prev.map((c) => {
            if (c.id !== editingClient.id) return c;
            const targetAutoSync = formData.autoSync !== undefined ? formData.autoSync : c.autoSync;
            return {
              ...c,
              ...formData,
              autoSync: targetAutoSync,
              status: targetAutoSync ? (c.status === 'paused' ? 'synced' : c.status) : 'paused',
            };
          })
        );
        addToast('success', 'Cliente Atualizado', `As alterações de ${formData.name || editingClient.name} foram salvas.`);
        setIsClientModalOpen(false);
        setEditingClient(null);
      } catch (err: any) {
        addToast('error', 'Erro ao Atualizar', err.message || 'Falha ao salvar alterações no banco de dados.');
      }
    } else {
      try {
        const result = await syncApiService.createClient(formData);
        if (result) {
          const newClient: SyncClient = {
            id: result.id,
            name: result.nome,
            sourcePath: result.pasta_origem,
            destinationPath: result.pasta_destino,
            autoSync: result.status_ativo,
            status: result.status_ativo ? 'synced' : 'paused',
            lastSyncAt: result.criado_em,
            nextSyncAt: null,
            intervalMinutes: 15,
            excludePatterns: '',
            stats: { filesCount: 0 },
          };
          setClients((prev) => [newClient, ...prev]);

          addToast(
            'success',
            'Cliente Criado',
            `${newClient.name} foi adicionado à coluna de ${newClient.autoSync ? 'Ativos' : 'Inativos'}.`
          );
          setIsClientModalOpen(false);
          setEditingClient(null);
        }
      } catch (err: any) {
        addToast('error', 'Erro ao Criar', err.message || 'Falha ao salvar novo cliente no banco de dados.');
      }
    }
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
        onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
        isSyncingAll={isSyncingAll}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Backend Disconnected Alert */}
        {!engineStats.fastApiConnected && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="font-extrabold block text-amber-100">Backend FastAPI desconectado</span>
                <span className="text-[11px] text-amber-300/80">
                  O servidor backend não respondeu em <code>{engineStats.fastApiUrl}</code>. Inicie o servidor FastAPI para sincronizar e salvar as alterações no banco de dados.
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsApiSettingsOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-xs border border-amber-500/30 transition-colors shrink-0 cursor-pointer"
            >
              Configurar URL
            </button>
          </div>
        )}

        {/* Header Banner */}
        <div className="mb-8 pb-7 border-b border-[#232130]">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.1]">
            Something <span className="text-[#b886fd]">sassy</span> is syncing.
          </h1>
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
                onDragStart={() => { }}
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
          <span>Desenvolvido por João Vitor Garcia</span>
          <span>·</span>
          <span>Uma aplicação <span className="text-[#b886fd] font-bold">Sassy Square</span></span>
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
        onClientCreated={(newClient) => {
          setClients((prev) => [newClient, ...prev.filter((c) => c.id !== newClient.id)]);
          addToast(
            'success',
            'Cliente e Remote Criados!',
            `${newClient.name} foi inicializado e adicionado aos ${newClient.autoSync ? 'Ativos' : 'Inativos'}.`
          );
        }}
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

      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSave={() => {
          addToast('success', 'Agendamento Atualizado', 'A periodicidade da sincronização foi salva com sucesso.');
        }}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

    </div>
  );
}
