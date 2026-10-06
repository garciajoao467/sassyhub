import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => {
        const icon = {
          success: <CheckCircle2 className="w-5 h-5 text-[#b886fd] shrink-0 mt-0.5" />,
          error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />,
          info: <Info className="w-5 h-5 text-[#b886fd] shrink-0 mt-0.5" />,
        }[toast.type];

        const borderStyle = {
          success: 'border-[#a855f7]/40 bg-[#161420]/95 text-white shadow-purple-950/40',
          error: 'border-rose-500/40 bg-[#181116]/95 text-white shadow-rose-950/30',
          warning: 'border-amber-500/40 bg-[#181512]/95 text-white shadow-amber-950/30',
          info: 'border-[#a855f7]/40 bg-[#161420]/95 text-white shadow-purple-950/40',
        }[toast.type];

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-xl transition-all duration-200 animate-in fade-in slide-in-from-bottom-3 ${borderStyle}`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold tracking-tight text-white">{toast.title}</h4>
              <p className="text-xs text-[#a39fae] mt-0.5 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-[#7c788c] hover:text-white transition-colors p-1 rounded-md -mr-1 -mt-1 hover:bg-white/10"
              aria-label="Fechar notificação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
