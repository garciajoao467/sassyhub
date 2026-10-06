import React from 'react';
import { Search, X, Columns, List } from 'lucide-react';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  viewMode: 'kanban' | 'list';
  onViewModeChange: (mode: 'kanban' | 'list') => void;
  totalFiltered: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  totalFiltered,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
      {/* Search Input with Sassy Square lavender focus and dark background */}
      <div className="relative flex-1 max-w-md">
        <Search className="w-4 h-4 text-[#8b879b] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por cliente, diretório de origem ou destino..."
          className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl bg-[#14131c] border border-[#2b283a] text-white placeholder-[#6d6b7b] focus:outline-none focus:border-[#b886fd] focus:ring-1 focus:ring-[#b886fd] transition-all duration-200"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b879b] hover:text-white p-0.5 rounded transition-colors cursor-pointer"
            title="Limpar busca"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* View Switcher: Colunas (Kanban) vs Lista */}
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center p-1 bg-[#14131c] rounded-xl border border-[#2b283a] shrink-0">
          <button
            onClick={() => onViewModeChange('kanban')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'kanban'
                ? 'bg-[#b886fd] text-black shadow-sm'
                : 'text-[#9e9ba8] hover:text-white'
            }`}
            title="Colunas Ativos vs Inativos (Arrastar e Soltar)"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Colunas (Arrastar)</span>
          </button>

          <button
            onClick={() => onViewModeChange('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-[#b886fd] text-black shadow-sm'
                : 'text-[#9e9ba8] hover:text-white'
            }`}
            title="Visualização em Lista Contínua"
          >
            <List className="w-3.5 h-3.5" />
            <span>Lista</span>
          </button>
        </div>
      </div>
    </div>
  );
};
