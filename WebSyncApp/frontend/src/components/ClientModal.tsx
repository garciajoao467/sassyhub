import React, { useState, useEffect } from 'react';
import { X, Folder, Cloud, Check } from 'lucide-react';
import { SyncClient } from '../types';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clientData: Partial<SyncClient>) => void;
  editingClient?: SyncClient | null;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingClient,
}) => {
  const [name, setName] = useState('');
  const [sourcePath, setSourcePath] = useState('');
  const [destinationPath, setDestinationPath] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [excludePatterns, setExcludePatterns] = useState('*.tmp, .DS_Store, .git');
  const [autoSync, setAutoSync] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingClient) {
      setName(editingClient.name);
      setSourcePath(editingClient.sourcePath);
      setDestinationPath(editingClient.destinationPath);
      setIntervalMinutes(editingClient.intervalMinutes);
      setExcludePatterns(editingClient.excludePatterns || '*.tmp, .DS_Store');
      setAutoSync(editingClient.autoSync);
    } else {
      setName('');
      setSourcePath('');
      setDestinationPath('');
      setIntervalMinutes(15);
      setExcludePatterns('*.tmp, .DS_Store, .git, node_modules');
      setAutoSync(true);
    }
    setErrors({});
  }, [editingClient, isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'O nome do cliente é obrigatório';
    if (!sourcePath.trim()) newErrors.sourcePath = 'Informe o caminho da pasta de origem';
    if (!destinationPath.trim()) newErrors.destinationPath = 'Informe o destino (local ou nuvem/S3)';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      name: name.trim(),
      sourcePath: sourcePath.trim(),
      destinationPath: destinationPath.trim(),
      intervalMinutes: Number(intervalMinutes),
      excludePatterns: excludePatterns.trim(),
      autoSync,
    });
  };

  const applyPreset = (type: 's3' | 'nas' | 'local') => {
    if (type === 's3') {
      setDestinationPath('s3://cloud-sync-storage/clientes/assets');
    } else if (type === 'nas') {
      setDestinationPath('\\\\srv-filecluster.local\\vault\\backups\\');
    } else {
      setDestinationPath('/Volumes/StorageBackup/Archive/');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog Card - Exactly matching the form panel in the Sassy Square screenshot */}
      <div className="relative w-full max-w-xl rounded-2xl bg-[#14131c] border border-[#2e2a40] shadow-2xl shadow-purple-950/70 p-7 z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#242131]">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] tracking-widest uppercase font-bold text-[#d8b4fe] bg-[#211a36] border border-[#a855f7]/40 mb-2">
              Sassy Square Config
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              {editingClient ? 'Editar Configuração de Sincronização' : 'Adicionar Novo Cliente'}
            </h2>
            <p className="text-xs text-[#9d9aa8] mt-1">
              Configure os diretórios e regras de automação do motor em segundo plano.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#858194] hover:text-white hover:bg-[#201e2c] transition-colors cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          
          {/* Nome do Cliente */}
          <div>
            <label className="block text-xs font-bold text-white mb-1.5">
              Nome do Cliente / Job <span className="text-[#b886fd]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Sassy Square — Marketing Media"
              className={`w-full px-4 py-2.5 rounded-xl bg-[#1a1824] border text-sm text-white placeholder-[#686576] focus:outline-none transition-all ${
                errors.name
                  ? 'border-rose-500 focus:border-rose-500'
                  : 'border-[#a855f7]/60 focus:border-[#b886fd] focus:ring-1 focus:ring-[#b886fd]'
              }`}
            />
            {errors.name && <p className="text-xs text-rose-400 mt-1">{errors.name}</p>}
          </div>

          {/* Caminho de Origem */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-white">
                Caminho de Origem (Local / Servidor) <span className="text-[#b886fd]">*</span>
              </label>
              <span className="text-[11px] text-[#8d899d]">Diretório monitorado</span>
            </div>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b886fd]">
                <Folder className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={sourcePath}
                onChange={(e) => setSourcePath(e.target.value)}
                placeholder="/srv/data/cliente_assets ou C:\Projetos\Assets"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1a1824] border font-mono text-xs text-white placeholder-[#686576] focus:outline-none transition-all ${
                  errors.sourcePath
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-[#a855f7]/60 focus:border-[#b886fd] focus:ring-1 focus:ring-[#b886fd]'
                }`}
              />
            </div>
            {errors.sourcePath && <p className="text-xs text-rose-400 mt-1">{errors.sourcePath}</p>}
          </div>

          {/* Caminho de Destino */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-white">
                Caminho de Destino (Nuvem / S3 ou Rede) <span className="text-[#b886fd]">*</span>
              </label>
              
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => applyPreset('s3')}
                  className="px-2 py-0.5 rounded-md bg-[#221c36] text-[#d8b4fe] hover:bg-[#2e264a] border border-[#a855f7]/30 transition-colors cursor-pointer"
                >
                  S3
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('nas')}
                  className="px-2 py-0.5 rounded-md bg-[#1f1d2b] text-[#9d9aa8] hover:bg-[#282638] border border-[#302d40] transition-colors cursor-pointer"
                >
                  NAS/SMB
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('local')}
                  className="px-2 py-0.5 rounded-md bg-[#1f1d2b] text-[#9d9aa8] hover:bg-[#282638] border border-[#302d40] transition-colors cursor-pointer"
                >
                  Local
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b886fd]">
                <Cloud className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={destinationPath}
                onChange={(e) => setDestinationPath(e.target.value)}
                placeholder="s3://cloud-sync-storage/production/ ou /mnt/backup_nas/vault"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1a1824] border font-mono text-xs text-white placeholder-[#686576] focus:outline-none transition-all ${
                  errors.destinationPath
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-[#a855f7]/60 focus:border-[#b886fd] focus:ring-1 focus:ring-[#b886fd]'
                }`}
              />
            </div>
            {errors.destinationPath && (
              <p className="text-xs text-rose-400 mt-1">{errors.destinationPath}</p>
            )}
          </div>

          {/* Frequência & Filtros removed - not supported in backend yet */}

          {/* Toggle Auto-Sync */}
          <div className="pt-2">
            <label className="flex items-center gap-3 p-3 rounded-xl bg-[#171520] border border-[#2b273c] cursor-pointer hover:border-[#a855f7]/40 transition-colors">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-8 h-4.5 rounded-full transition-colors duration-200 ${
                  autoSync ? 'bg-[#b886fd]' : 'bg-[#292636]'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-transform duration-200 m-0.5 ${
                    autoSync ? 'translate-x-3.5 bg-black' : 'translate-x-0 bg-white'
                  }`}
                />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  Inserir na coluna de &quot;Clientes Ativos&quot;
                </span>
                <span className="text-[11px] text-[#8e8a9c]">
                  O motor começará a sincronização imediatamente em background.
                </span>
              </div>
            </label>
          </div>

          {/* Botões do Rodapé: Estilo Sassy Lavender "Submit" Button */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#242131]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-[#a19dae] hover:text-white bg-[#1b1926] hover:bg-[#252236] border border-[#2e2a40] rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-extrabold text-black bg-[#b886fd] hover:bg-[#c99eff] active:bg-[#a770fa] rounded-xl shadow-lg shadow-purple-950/60 transition-all duration-200 hover:scale-[1.02] cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{editingClient ? 'Salvar Alterações' : 'Salvar Cliente'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
