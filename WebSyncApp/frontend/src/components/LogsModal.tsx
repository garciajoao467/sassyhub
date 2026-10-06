import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Terminal,
  Copy,
  Check,
  Download,
  Trash2,
  Play,
  RotateCw,
  Filter,
  ArrowDown,
} from 'lucide-react';
import { SyncClient, LogEntry, LogLevel } from '../types';

interface LogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: SyncClient | null;
  logs: LogEntry[];
  onAddLogEntry?: (clientId: string, entry: Omit<LogEntry, 'id'>) => void;
  onClearLogs?: (clientId: string) => void;
}

export const LogsModal: React.FC<LogsModalProps> = ({
  isOpen,
  onClose,
  client,
  logs,
  onAddLogEntry,
  onClearLogs,
}) => {
  const [levelFilter, setLevelFilter] = useState<'ALL' | LogLevel>('ALL');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && isOpen) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isOpen]);

  if (!isOpen || !client) return null;

  const filteredLogs = logs.filter((log) => {
    if (levelFilter === 'ALL') return true;
    return log.level === levelFilter;
  });

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level}] ${l.message} ${l.details ? `\n  -> ${l.details}` : ''}`)
      .join('\n');
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level}] ${l.message} ${l.details ? `\n  -> ${l.details}` : ''}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `websync-${client.id}-${new Date().toISOString().slice(0, 10)}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSimulateLogEvent = () => {
    if (!onAddLogEntry) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    
    const events: Array<{ level: LogLevel; message: string; details?: string }> = [
      {
        level: 'INFO',
        message: `FastAPI inotify: Modificação detectada em ${client.sourcePath}/asset_${Math.floor(Math.random() * 9000 + 1000)}.png`,
        details: 'Delta sync inicializado pelo worker de background (PID 4812).',
      },
      {
        level: 'SUCCESS',
        message: `Sincronização concluída com integridade validada em ${(Math.random() * 1.5 + 0.4).toFixed(2)}s`,
        details: `Destino: ${client.destinationPath} [Status 200 OK]`,
      },
      {
        level: 'WARN',
        message: `Arquivo temporário ignorado pela regra de exclusão [${client.excludePatterns.split(',')[0]}].`,
      },
    ];

    const pick = events[Math.floor(Math.random() * events.length)];
    onAddLogEntry(client.id, {
      timestamp: timeStr,
      level: pick.level,
      message: pick.message,
      details: pick.details,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Terminal Window Card */}
      <div className="relative w-full max-w-4xl rounded-2xl bg-[#0e0d15] border border-[#2b283d] shadow-2xl shadow-purple-950/80 flex flex-col max-h-[88vh] z-10 animate-in fade-in zoom-in-95 duration-200 overflow-hidden font-mono">
        
        {/* Simple Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#151420] border-b border-[#232032]">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Histórico de Sincronização
            </h2>
            <p className="text-xs text-[#8a8698] mt-0.5">
              Logs de atividade de {client.name}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-[#858194] hover:text-white hover:bg-[#201e2c] rounded transition-colors cursor-pointer"
            aria-label="Fechar terminal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-[#12111b] border-b border-[#232032] text-xs">
          {/* Level Filter Tabs */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#7e7a8e] uppercase font-bold mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#b886fd]" /> Nível:
            </span>
            {(['ALL', 'SUCCESS', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                  levelFilter === lvl
                    ? 'bg-[#b886fd] text-black font-bold shadow-sm'
                    : 'text-[#8b879b] hover:text-white hover:bg-[#1f1d2c]'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">

            <button
              onClick={handleCopyLogs}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#181622] hover:bg-[#222030] text-slate-300 hover:text-white text-[11px] border border-[#2b283d] transition-colors cursor-pointer"
              title="Copiar texto do terminal"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-300">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-[#8b879b]" />
                  <span>Copiar</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadLogs}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#181622] hover:bg-[#222030] text-slate-300 hover:text-white text-[11px] border border-[#2b283d] transition-colors cursor-pointer"
              title="Baixar arquivo .log"
            >
              <Download className="w-3 h-3 text-[#8b879b]" />
              <span>Baixar</span>
            </button>

            {onClearLogs && (
              <button
                onClick={() => onClearLogs(client.id)}
                className="p-1 rounded-lg bg-[#181622] hover:bg-rose-950/40 text-[#8b879b] hover:text-rose-400 text-[11px] border border-[#2b283d] transition-colors cursor-pointer"
                title="Limpar tela"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2 text-sm text-slate-200 bg-[#0e0d15] min-h-[300px]">

          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-[#5f5c6e]">
              <p>Nenhum registro de log encontrado para o filtro selecionado.</p>
              <p className="text-[11px] mt-1 text-[#4f4c5e]">
                Pressione &quot;Simular Evento&quot; acima para registrar novas linhas no terminal.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const badgeStyle = {
                SUCCESS: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                INFO: 'text-[#b886fd] bg-[#221a36] border-[#a855f7]/30',
                WARN: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                ERROR: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
              }[log.level];

              return (
                <div
                  key={log.id}
                  className="group flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 hover:bg-[#161520] p-1 rounded transition-colors"
                >
                  <span className="text-[#595568] shrink-0 tabular-nums text-[11px]">
                    {log.timestamp}
                  </span>
                  
                  <span
                    className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 border ${badgeStyle}`}
                  >
                    {log.level}
                  </span>

                  <div className="flex-1 min-w-0">
                    <span
                      className={`break-words ${
                        log.level === 'ERROR'
                          ? 'text-rose-300 font-semibold'
                          : log.level === 'SUCCESS'
                          ? 'text-emerald-300'
                          : log.level === 'WARN'
                          ? 'text-amber-200'
                          : 'text-slate-200'
                      }`}
                    >
                      {log.message}
                    </span>

                    {log.details && (
                      <p className="text-[11px] text-[#807c91] mt-0.5 pl-2 border-l border-[#2e2a40] font-mono">
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}

          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
};
