import React from 'react';
import { RefreshCw, Plus, Sliders } from 'lucide-react';

interface HeaderProps {
  onOpenNewClientModal: () => void;
  onSyncAll: () => void;
  onOpenApiSettings: () => void;
  isSyncingAll?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewClientModal,
  onSyncAll,
  onOpenApiSettings,
  isSyncingAll = false,
}) => {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#232130] bg-[#0e0e13]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
        
        {/* Brand Lockup inspired directly by Sassy Square */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-[#1a1824] border border-[#a855f7]/50 flex items-center justify-center relative overflow-hidden group shadow-md shadow-purple-950/40">
            <div className="absolute inset-0 bg-gradient-to-br from-[#a855f7]/20 to-transparent" />
            <span className="font-extrabold text-lg text-white group-hover:text-[#b886fd] transition-colors">
              S<span className="text-[#b886fd]">²</span>
            </span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight text-white font-sans">
                WebSync <span className="text-[#b886fd] font-black">sassy</span>
              </span>
              <span className="hidden sm:inline-flex text-[10px] tracking-widest uppercase font-semibold text-[#d8b4fe] bg-[#1d1633] px-2.5 py-0.5 rounded-full border border-[#a855f7]/40">
                Engine
              </span>
            </div>
            <span className="text-xs text-[#9d9ca7] hidden md:inline">
              Background File Synchronization & Automation
            </span>
          </div>
        </div>

        {/* Primary Actions matching Sassy Square Screenshot */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onSyncAll}
            disabled={isSyncingAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#181722] hover:bg-[#22212f] border border-[#2e2c3e] hover:border-[#a855f7]/50 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50"
            title="Sincronizar todos os clientes ativos"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#b886fd] ${isSyncingAll ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sincronizar Tudo</span>
          </button>

          {/* Sassy Lavender Button from Screenshot ("Submit" button style) */}
          <button
            onClick={onOpenNewClientModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-extrabold text-black bg-[#b886fd] hover:bg-[#c99eff] active:bg-[#a770fa] rounded-xl shadow-lg shadow-purple-950/50 transition-all duration-200 hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Novo Cliente</span>
          </button>

          <button
            onClick={onOpenApiSettings}
            className="p-2 text-slate-400 hover:text-white hover:bg-[#1f1d2b] rounded-xl border border-transparent hover:border-[#2e2c3e] transition-colors lg:hidden cursor-pointer"
            title="Configurações FastAPI"
            aria-label="Configurações FastAPI"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
