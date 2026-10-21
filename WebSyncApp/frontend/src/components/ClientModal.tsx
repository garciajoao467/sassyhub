import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Folder, 
  Cloud, 
  Check, 
  Loader2, 
  Terminal, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { SyncClient } from '../types';
import { syncApiService } from '../services/api';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clientData: Partial<SyncClient>) => void;
  onClientCreated?: (newClient: SyncClient) => void;
  editingClient?: SyncClient | null;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onClientCreated,
  editingClient,
}) => {
  // Form fields
  const [name, setName] = useState('');
  const [folderId, setFolderId] = useState('');
  const [sourcePath, setSourcePath] = useState('');
  const [destinationPath, setDestinationPath] = useState('');
  const [customRemoteName, setCustomRemoteName] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoStartCargaZero, setAutoStartCargaZero] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Carga Zero state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunningCargaZero, setIsRunningCargaZero] = useState(false);
  const [cargaZeroLogs, setCargaZeroLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [stepStatus, setStepStatus] = useState<{
    remoteCreated: boolean;
    step1Upload: 'idle' | 'running' | 'success' | 'error';
    step2Download: 'idle' | 'running' | 'success' | 'error';
    step3Bisync: 'idle' | 'running' | 'success' | 'error';
  }>({
    remoteCreated: false,
    step1Upload: 'idle',
    step2Download: 'idle',
    step3Bisync: 'idle',
  });
  const [cargaZeroResult, setCargaZeroResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdClientObj, setCreatedClientObj] = useState<SyncClient | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (isRunningCargaZero && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [cargaZeroLogs, isRunningCargaZero]);

  // Gera o nome do remote a partir do nome do cliente
  const gerarNomeRemoteLocal = (clientName: string) => {
    if (!clientName.trim()) return '';
    const clean = clientName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’]s\b/gi, 's')
      .replace(/['’]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .map((w) => (w === w.toUpperCase() && w.length <= 4 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join('');
    return clean ? `remote_${clean}` : '';
  };

  const calculatedRemoteName = customRemoteName.trim() || gerarNomeRemoteLocal(name);

  // Inicialização e preenchimento
  useEffect(() => {
    if (editingClient) {
      setName(editingClient.name);
      setSourcePath(editingClient.sourcePath);
      setDestinationPath(editingClient.destinationPath);
      setAutoSync(editingClient.autoSync);
      setFolderId('');
      setCustomRemoteName('');
      setShowAdvanced(false);
    } else {
      setName('');
      setFolderId('');
      setSourcePath('');
      setDestinationPath('');
      setCustomRemoteName('');
      setShowAdvanced(false);
      setAutoStartCargaZero(false);
      setAutoSync(true);
    }
    setErrors({});
    setIsSubmitting(false);
    setIsRunningCargaZero(false);
    setCargaZeroLogs([]);
    setCargaZeroResult(null);
    setErrorMessage(null);
    setCreatedClientObj(null);
    setStepStatus({
      remoteCreated: false,
      step1Upload: 'idle',
      step2Download: 'idle',
      step3Bisync: 'idle',
    });
  }, [editingClient, isOpen]);

  // Atualiza caminhos sugeridos conforme o usuário digita o nome
  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingClient) {
      const baseDir = 'A:\\SASSY SQUARE MARKETING\\Clientes Sassy';
      setSourcePath(val.trim() ? `${baseDir}\\${val.trim()}` : '');
    }
  };

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'O nome do cliente é obrigatório';

    if (editingClient) {
      if (!sourcePath.trim()) newErrors.sourcePath = 'Informe o caminho da pasta de origem';
      if (!destinationPath.trim()) newErrors.destinationPath = 'Informe o destino';
    } else {
      if (!folderId.trim()) newErrors.folderId = 'Informe o ID da pasta ou Shared Drive no Google Drive';
      if (!sourcePath.trim()) newErrors.sourcePath = 'Informe a pasta local no PC/servidor';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Modo Edição existente
    if (editingClient) {
      onSave({
        name: name.trim(),
        sourcePath: sourcePath.trim(),
        destinationPath: destinationPath.trim(),
        autoSync: autoSync,
      });
      return;
    }

    // Modo Criação de Novo Cliente com Onboarding Rclone
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Cadastra o remote e registra o cliente no backend
      const onboardResp = await syncApiService.onboardClient({
        nome: name.trim(),
        pasta_id: folderId.trim(),
        pasta_origem: sourcePath.trim(),
        nome_remote: calculatedRemoteName,
        status_ativo: true, // Registra sempre como Ativo no banco de dados
        iniciar_carga_zero: autoStartCargaZero,
      });

      if (!onboardResp || !onboardResp.cliente) {
        throw new Error('Não foi possível obter resposta da criação do cliente.');
      }

      const client = onboardResp.cliente;
      const newClientObj: SyncClient = {
        id: client.id,
        name: client.nome,
        sourcePath: client.pasta_origem,
        destinationPath: client.pasta_destino,
        autoSync: client.status_ativo,
        status: client.status_ativo ? 'synced' : 'paused',
        lastSyncAt: client.ultimo_sync,
        nextSyncAt: null,
        intervalMinutes: 15,
        excludePatterns: '',
        stats: { filesCount: 0 },
      };

      setCreatedClientObj(newClientObj);
      setStepStatus((prev) => ({ ...prev, remoteCreated: true }));

      // Se o operador não quis executar a carga zero agora:
      if (!autoStartCargaZero) {
        if (onClientCreated) onClientCreated(newClientObj);
        setIsSubmitting(false);
        onClose();
        return;
      }

      // 2. Inicia o Marco Zero (Carga Inicial) com streaming de logs ao vivo
      setIsRunningCargaZero(true);
      setStepStatus((prev) => ({ ...prev, step1Upload: 'running' }));
      setCurrentStep(1);

      syncApiService.cargaZeroStream(
        client.id,
        (line: string) => {
          setCargaZeroLogs((prev) => [...prev, line]);

          // Atualiza etapas com base nas mensagens do stream
          if (line.includes('[ETAPA 1/3]')) {
            setCurrentStep(1);
            setStepStatus((prev) => ({ ...prev, step1Upload: 'running' }));
          } else if (line.includes('[ETAPA 2/3]')) {
            setCurrentStep(2);
            setStepStatus((prev) => ({
              ...prev,
              step1Upload: 'success',
              step2Download: 'running',
            }));
          } else if (line.includes('[ETAPA 3/3]')) {
            setCurrentStep(3);
            setStepStatus((prev) => ({
              ...prev,
              step2Download: 'success',
              step3Bisync: 'running',
            }));
          }
        },
        (success: boolean, message?: string) => {
          setIsRunningCargaZero(false);
          setIsSubmitting(false);

          if (success) {
            setCargaZeroResult('success');
            setStepStatus({
              remoteCreated: true,
              step1Upload: 'success',
              step2Download: 'success',
              step3Bisync: 'success',
            });

            // Atualiza status do cliente para ativo
            const finalClient: SyncClient = {
              ...newClientObj,
              autoSync: true,
              status: 'synced',
              lastSyncAt: new Date().toISOString(),
            };
            setCreatedClientObj(finalClient);
            if (onClientCreated) onClientCreated(finalClient);
          } else {
            setCargaZeroResult('error');
            setErrorMessage(message || 'Erro durante a sincronização inicial.');
            setStepStatus((prev) => {
              if (currentStep === 1) return { ...prev, step1Upload: 'error' };
              if (currentStep === 2) return { ...prev, step2Download: 'error' };
              return { ...prev, step3Bisync: 'error' };
            });
          }
        }
      );
    } catch (err: any) {
      setIsSubmitting(false);
      setIsRunningCargaZero(false);
      setErrorMessage(err.message || 'Erro ao conectar ao servidor.');
    }
  };

  const handleFinish = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Blurred Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={isRunningCargaZero ? undefined : onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#14131c] border border-[#2e2a40] shadow-2xl shadow-purple-950/70 p-7 z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#242131]">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] tracking-widest uppercase font-bold text-[#d8b4fe] bg-[#211a36] border border-[#a855f7]/40 mb-2">
              <Sparkles className="w-3 h-3 text-[#c084fc]" />
              Sassy WebSync Engine
            </div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              {editingClient 
                ? 'Editar Configuração do Cliente' 
                : isRunningCargaZero || cargaZeroResult
                  ? 'Inicialização do Cliente (Marco Zero)'
                  : 'Adicionar Novo Cliente e Remote'}
            </h2>
            <p className="text-xs text-[#9d9aa8] mt-1">
              {editingClient
                ? 'Altere as configurações de diretório e automação.'
                : isRunningCargaZero || cargaZeroResult
                  ? 'Executando criação do remote no Rclone e carga inicial do Bisync.'
                  : 'Criação automática do remote no Rclone e sincronização bidirecional do Google Drive.'}
            </p>
          </div>
          {!isRunningCargaZero && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#858194] hover:text-white hover:bg-[#201e2c] transition-colors cursor-pointer"
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* MODO CARGA ZERO AO VIVO / PROGRESSO */}
        {(isRunningCargaZero || cargaZeroResult) && (
          <div className="mt-5 space-y-4">
            {/* Status Steps Cards */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              
              {/* Step 0: Remote Rclone */}
              <div className="p-3 rounded-xl bg-[#191724] border border-[#2f2b42] flex flex-col justify-between">
                <div className="text-[10px] font-bold text-[#8e8a9c] uppercase tracking-wider">Remote</div>
                <div className="flex items-center gap-1.5 mt-1 font-semibold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">Criado</span>
                </div>
              </div>

              {/* Step 1: Upload */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
                stepStatus.step1Upload === 'running'
                  ? 'bg-[#211a36] border-[#a855f7] text-[#d8b4fe]'
                  : stepStatus.step1Upload === 'success'
                  ? 'bg-[#191724] border-[#2f2b42] text-emerald-400'
                  : stepStatus.step1Upload === 'error'
                  ? 'bg-rose-950/30 border-rose-600 text-rose-300'
                  : 'bg-[#161420] border-[#242131] text-[#6d6a7d]'
              }`}>
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">1. Upload</div>
                <div className="flex items-center gap-1.5 mt-1 font-semibold truncate">
                  {stepStatus.step1Upload === 'running' && <Loader2 className="w-4 h-4 animate-spin shrink-0 text-[#b886fd]" />}
                  {stepStatus.step1Upload === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {stepStatus.step1Upload === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span className="truncate">
                    {stepStatus.step1Upload === 'running' ? 'Subindo...' : stepStatus.step1Upload === 'success' ? 'Concluído' : stepStatus.step1Upload === 'error' ? 'Falhou' : 'Pendente'}
                  </span>
                </div>
              </div>

              {/* Step 2: Download */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
                stepStatus.step2Download === 'running'
                  ? 'bg-[#211a36] border-[#a855f7] text-[#d8b4fe]'
                  : stepStatus.step2Download === 'success'
                  ? 'bg-[#191724] border-[#2f2b42] text-emerald-400'
                  : stepStatus.step2Download === 'error'
                  ? 'bg-rose-950/30 border-rose-600 text-rose-300'
                  : 'bg-[#161420] border-[#242131] text-[#6d6a7d]'
              }`}>
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">2. Nuvem</div>
                <div className="flex items-center gap-1.5 mt-1 font-semibold truncate">
                  {stepStatus.step2Download === 'running' && <Loader2 className="w-4 h-4 animate-spin shrink-0 text-[#b886fd]" />}
                  {stepStatus.step2Download === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {stepStatus.step2Download === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span className="truncate">
                    {stepStatus.step2Download === 'running' ? 'Baixando...' : stepStatus.step2Download === 'success' ? 'Concluído' : stepStatus.step2Download === 'error' ? 'Falhou' : 'Pendente'}
                  </span>
                </div>
              </div>

              {/* Step 3: Marco Zero Bisync */}
              <div className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${
                stepStatus.step3Bisync === 'running'
                  ? 'bg-[#211a36] border-[#a855f7] text-[#d8b4fe]'
                  : stepStatus.step3Bisync === 'success'
                  ? 'bg-[#191724] border-[#2f2b42] text-emerald-400'
                  : stepStatus.step3Bisync === 'error'
                  ? 'bg-rose-950/30 border-rose-600 text-rose-300'
                  : 'bg-[#161420] border-[#242131] text-[#6d6a7d]'
              }`}>
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">3. Marco Zero</div>
                <div className="flex items-center gap-1.5 mt-1 font-semibold truncate">
                  {stepStatus.step3Bisync === 'running' && <Loader2 className="w-4 h-4 animate-spin shrink-0 text-[#b886fd]" />}
                  {stepStatus.step3Bisync === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {stepStatus.step3Bisync === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  <span className="truncate">
                    {stepStatus.step3Bisync === 'running' ? 'Bisync...' : stepStatus.step3Bisync === 'success' ? 'Sincronizado' : stepStatus.step3Bisync === 'error' ? 'Falhou' : 'Pendente'}
                  </span>
                </div>
              </div>

            </div>

            {/* Banner de Resultado */}
            {cargaZeroResult === 'success' && (
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center gap-3 text-emerald-300 text-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-emerald-200">Cliente Inicializado e Ativado com Sucesso!</div>
                  <div className="text-[11px] text-emerald-300/80 mt-0.5">
                    O remote <strong>{calculatedRemoteName}:</strong> foi vinculado e o Marco Zero bidirecional está consolidado.
                  </div>
                </div>
              </div>
            )}

            {cargaZeroResult === 'error' && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-3 text-rose-300 text-xs">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-rose-200">Falha durante o Marco Zero</div>
                  <div className="text-[11px] text-rose-300/80 mt-0.5">{errorMessage}</div>
                </div>
              </div>
            )}

            {/* Terminal Live Output */}
            <div className="rounded-xl bg-[#0d0c14] border border-[#232033] p-3 font-mono text-[11px] text-[#cfcbdc] h-56 overflow-y-auto shadow-inner flex flex-col justify-between">
              <div className="flex items-center gap-2 pb-2 mb-2 border-b border-[#1c1a29] text-[10px] text-[#7d798f] tracking-widest uppercase font-bold">
                <Terminal className="w-3.5 h-3.5 text-[#a855f7]" />
                <span>Console Rclone em Tempo Real</span>
              </div>
              <div className="space-y-1 overflow-y-auto flex-1 font-mono text-xs">
                {cargaZeroLogs.length === 0 && (
                  <div className="text-[#646175] italic">Aguardando saída dos processos do motor...</div>
                )}
                {cargaZeroLogs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={`leading-relaxed break-all ${
                      log.includes('ETAPA') || log.includes('MARCO ZERO') 
                        ? 'text-[#d8b4fe] font-bold' 
                        : log.includes('ERRO') || log.includes('Falha') 
                        ? 'text-rose-400 font-semibold' 
                        : log.includes('OK') || log.includes('CONCLUIDO')
                        ? 'text-emerald-400 font-bold'
                        : 'text-[#a6a2b8]'
                    }`}
                  >
                    {log}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* Ações pós Carga Zero */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#242131]">
              {cargaZeroResult === 'success' ? (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-extrabold text-black bg-[#b886fd] hover:bg-[#c99eff] rounded-xl shadow-lg shadow-purple-950/60 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Concluir e Ver no Kanban</span>
                </button>
              ) : cargaZeroResult === 'error' ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#252236] hover:bg-[#322d4a] rounded-xl transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              ) : (
                <div className="text-xs text-[#8e8a9c] flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#b886fd]" />
                  <span>Sincronizando arquivos, por favor não feche a janela...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FORMULÁRIO DE ENTRADA (QUANDO NÃO ESTÁ EM CARGA ZERO) */}
        {!isRunningCargaZero && !cargaZeroResult && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            
            {/* Mensagem de Erro Geral */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Nome do Cliente */}
            <div>
              <label className="block text-xs font-bold text-white mb-1.5">
                Nome do Cliente / Empresa <span className="text-[#b886fd]">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Top Notch Builders"
                disabled={isSubmitting}
                className={`w-full px-4 py-2.5 rounded-xl bg-[#1a1824] border text-sm text-white placeholder-[#686576] focus:outline-none transition-all ${
                  errors.name
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-[#a855f7]/60 focus:border-[#b886fd] focus:ring-1 focus:ring-[#b886fd]'
                }`}
              />
              {errors.name && <p className="text-xs text-rose-400 mt-1">{errors.name}</p>}
            </div>

            {/* SE FOR NOVO CLIENTE: ID DA PASTA DO GOOGLE DRIVE */}
            {!editingClient && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-white">
                    ID da Pasta / Shared Drive (Google Drive) <span className="text-[#b886fd]">*</span>
                  </label>
                  <span className="text-[11px] text-[#b886fd]">Obrigatório para o Remote</span>
                </div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b886fd]">
                    <Cloud className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    placeholder="Ex: 0AFeRwP27tuIaUk9PVA ou 1A2b3C4d5E6f..."
                    disabled={isSubmitting}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1a1824] border font-mono text-xs text-white placeholder-[#686576] focus:outline-none transition-all ${
                      errors.folderId
                        ? 'border-rose-500 focus:border-rose-500'
                        : 'border-[#a855f7]/60 focus:border-[#b886fd] focus:ring-1 focus:ring-[#b886fd]'
                    }`}
                  />
                </div>
                {errors.folderId ? (
                  <p className="text-xs text-rose-400 mt-1">{errors.folderId}</p>
                ) : (
                  <p className="text-[11px] text-[#8e8a9c] mt-1">
                    Cole o ID do link da pasta do Google Drive (ex: após <code>/folders/</code> ou ID do Drive compartilhado).
                  </p>
                )}

                {/* Badge com preview do Remote que será criado */}
                {calculatedRemoteName && (
                  <div className="mt-2.5 flex items-center justify-between px-3 py-2 rounded-xl bg-[#1c192b] border border-[#a855f7]/30 text-xs">
                    <span className="text-[#a6a2b8]">Remote gerado no Rclone:</span>
                    <span className="font-mono font-bold text-[#d8b4fe] bg-[#271f3d] px-2.5 py-0.5 rounded-lg border border-[#a855f7]/40">
                      {calculatedRemoteName}:
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Caminho de Origem (Local / Servidor) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-white">
                  Pasta Local no Servidor (Origem) <span className="text-[#b886fd]">*</span>
                </label>
                <span className="text-[11px] text-[#8d899d]">Diretório monitorado no PC</span>
              </div>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b886fd]">
                  <Folder className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={sourcePath}
                  onChange={(e) => setSourcePath(e.target.value)}
                  placeholder="A:\SASSY SQUARE MARKETING\Clientes Sassy\Nome"
                  disabled={isSubmitting}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1a1824] border font-mono text-xs text-white placeholder-[#686576] focus:outline-none transition-all ${
                    errors.sourcePath
                      ? 'border-rose-500 focus:border-rose-500'
                      : 'border-[#a855f7]/60 focus:border-[#b886fd] focus:ring-1 focus:ring-[#b886fd]'
                  }`}
                />
              </div>
              {errors.sourcePath && <p className="text-xs text-rose-400 mt-1">{errors.sourcePath}</p>}
            </div>

            {/* SE FOR EDIÇÃO: CAMINHO DE DESTINO */}
            {editingClient && (
              <>
                <div>
                  <label className="block text-xs font-bold text-white mb-1.5">
                    Destino (Remote Rclone) <span className="text-[#b886fd]">*</span>
                  </label>
                  <input
                    type="text"
                    value={destinationPath}
                    onChange={(e) => setDestinationPath(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#1a1824] border border-[#a855f7]/60 font-mono text-xs text-white"
                  />
                </div>

                {/* SE FOR EDIÇÃO: STATUS ATIVO / PAUSADO */}
                <div className="pt-1">
                  <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#181624] border border-[#2f2b42] cursor-pointer hover:border-[#a855f7]/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={autoSync}
                      onChange={(e) => setAutoSync(e.target.checked)}
                      disabled={isSubmitting}
                      className="sr-only"
                    />
                    <div
                      className={`w-9 h-5 rounded-full transition-colors duration-200 ${
                        autoSync ? 'bg-[#b886fd]' : 'bg-[#292636]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full transition-transform duration-200 m-0.5 ${
                          autoSync ? 'translate-x-4 bg-black' : 'translate-x-0 bg-white'
                        }`}
                      />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {autoSync ? 'Cliente Ativo (Auto-Sync Ligado)' : 'Cliente Inativo (Auto-Sync Pausado)'}
                      </span>
                      <span className="text-[11px] text-[#8e8a9c] block mt-0.5">
                        {autoSync 
                          ? 'O motor em segundo plano incluirá este cliente na rotina de sincronização periódica.' 
                          : 'A sincronização automática está suspensa. O cliente só sincroniza se forçado manualmente.'}
                      </span>
                    </div>
                  </label>
                </div>
              </>
            )}

            {/* Opções Avançadas (Toggle) */}
            {!editingClient && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1.5 text-xs text-[#a19dae] hover:text-[#d8b4fe] transition-colors cursor-pointer"
                >
                  {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>Configurações Avançadas do Remote</span>
                </button>

                {showAdvanced && (
                  <div className="mt-3 p-3.5 rounded-xl bg-[#171522] border border-[#2e2a40] space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#cfcbdc] mb-1">
                        Nome Customizado do Remote no rclone.conf (opcional)
                      </label>
                      <input
                        type="text"
                        value={customRemoteName}
                        onChange={(e) => setCustomRemoteName(e.target.value)}
                        placeholder={`Padrão: ${gerarNomeRemoteLocal(name) || 'remote_Cliente'}`}
                        className="w-full px-3 py-2 rounded-lg bg-[#14121d] border border-[#3b3652] text-xs font-mono text-white focus:outline-none focus:border-[#b886fd]"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Checkbox: Carga Inicial e Marco Zero */}
            {!editingClient && (
              <div className="pt-2">
                <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#181624] border border-[#2f2b42] cursor-pointer hover:border-[#a855f7]/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={autoStartCargaZero}
                    onChange={(e) => setAutoStartCargaZero(e.target.checked)}
                    disabled={isSubmitting}
                    className="sr-only"
                  />
                  <div
                    className={`w-9 h-5 rounded-full transition-colors duration-200 ${
                      autoStartCargaZero ? 'bg-[#b886fd]' : 'bg-[#292636]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full transition-transform duration-200 m-0.5 ${
                        autoStartCargaZero ? 'translate-x-4 bg-black' : 'translate-x-0 bg-white'
                      }`}
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Executar Carga Inicial e Marco Zero imediatamente
                    </span>
                    <span className="text-[11px] text-[#8e8a9c] block mt-0.5">
                      Sobe os arquivos do PC para o Google Drive, baixa novidades e inicia o <code>bisync --resync</code> para incluir o cliente como Ativo.
                    </span>
                  </div>
                </label>
              </div>
            )}

            {/* Botões do Rodapé */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#242131]">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-bold text-[#a19dae] hover:text-white bg-[#1b1926] hover:bg-[#252236] border border-[#2e2a40] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-extrabold text-black bg-[#b886fd] hover:bg-[#c99eff] active:bg-[#a770fa] rounded-xl shadow-lg shadow-purple-950/60 transition-all duration-200 hover:scale-[1.02] cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>Configurando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>{editingClient ? 'Salvar Alterações' : 'Criar Remote e Inicializar'}</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
