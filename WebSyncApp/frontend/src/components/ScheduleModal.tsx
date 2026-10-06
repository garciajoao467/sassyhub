import React, { useState, useEffect } from 'react';
import { Clock, CalendarClock, X, Save } from 'lucide-react';
import { syncApiService } from '../services/api';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({ isOpen, onClose, onSave }) => {
  const [mode, setMode] = useState<'cron' | 'interval'>('cron');
  const [cronTime, setCronTime] = useState('02:00');
  const [intervalHours, setIntervalHours] = useState('12');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      syncApiService.getScheduleConfig()
        .then((config) => {
          setMode(config.sync_mode as 'cron' | 'interval');
          if (config.sync_mode === 'cron') {
            setCronTime(config.sync_value);
          } else {
            setIntervalHours(config.sync_value);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await syncApiService.updateScheduleConfig({
        sync_mode: mode,
        sync_value: mode === 'cron' ? cronTime : intervalHours
      });
      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save schedule config', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-[#13111c] border border-[#2b283d] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#232032] bg-[#171523]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <CalendarClock className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Agendamento Automático</h2>
              <p className="text-xs text-slate-400 mt-0.5">Define quando a sincronização global rodará</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-[#252236] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Opções de Modo */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('cron')}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border text-sm transition-all cursor-pointer ${
                    mode === 'cron'
                      ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300'
                      : 'bg-[#1a1726] border-[#2b283d] text-slate-400 hover:bg-[#201d30]'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">Horário Fixo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('interval')}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border text-sm transition-all cursor-pointer ${
                    mode === 'interval'
                      ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300'
                      : 'bg-[#1a1726] border-[#2b283d] text-slate-400 hover:bg-[#201d30]'
                  }`}
                >
                  <CalendarClock className="w-5 h-5" />
                  <span className="font-medium">Intervalo Regular</span>
                </button>
              </div>

              <div className="h-[1px] bg-[#232032]" />

              {/* Formulário Dinâmico */}
              <div>
                {mode === 'cron' ? (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <label className="block text-sm font-medium text-slate-300">
                      Horário de Execução Diária
                    </label>
                    <p className="text-xs text-slate-500 mb-2">
                      A sincronização de todos os clientes ativos ocorrerá todos os dias neste horário exato.
                    </p>
                    <input
                      type="time"
                      value={cronTime}
                      onChange={(e) => setCronTime(e.target.value)}
                      className="w-full bg-[#0a0a0f] border border-[#2b283d] text-slate-200 text-sm rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 transition-colors"
                    />
                  </div>
                ) : (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <label className="block text-sm font-medium text-slate-300">
                      Frequência (em horas)
                    </label>
                    <p className="text-xs text-slate-500 mb-2">
                      A sincronização repetirá a cada intervalo definido abaixo.
                    </p>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="168"
                        value={intervalHours}
                        onChange={(e) => setIntervalHours(e.target.value)}
                        className="w-full bg-[#0a0a0f] border border-[#2b283d] text-slate-200 text-sm rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 pr-12 transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                        hrs
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#171523] border-t border-[#232032] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-900/20 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar
          </button>
        </div>

      </div>
    </div>
  );
};
