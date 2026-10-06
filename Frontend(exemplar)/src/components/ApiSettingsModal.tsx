import React, { useState } from 'react';
import { X, Server, CheckCircle2, AlertCircle, RefreshCw, Copy, Check, Code } from 'lucide-react';
import { syncApiService } from '../services/api';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUrlChange: (newUrl: string) => void;
  currentUrl: string;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({
  isOpen,
  onClose,
  onUrlChange,
  currentUrl,
}) => {
  const [url, setUrl] = useState(currentUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    syncApiService.setBaseUrl(url);
    const res = await syncApiService.checkHealth();
    setTestResult(res);
    setTesting(false);
  };

  const handleSave = () => {
    syncApiService.setBaseUrl(url);
    onUrlChange(url);
    onClose();
  };

  const samplePythonCode = `# Rotas FastAPI para o WebSync Manager (Sassy Square Edition)
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="WebSync Engine API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "engine": "running"}

@app.post("/api/clients/{client_id}/sync")
def force_sync(client_id: str, background_tasks: BackgroundTasks):
    # background_tasks.add_task(run_file_sync, client_id)
    return {"status": "queued", "client_id": client_id}

@app.patch("/api/clients/{client_id}/autosync")
def toggle_auto_sync(client_id: str, payload: dict):
    # Salva status no banco / inicia ou pausa o monitor inotify
    return {"status": "updated", "autoSync": payload.get("autoSync")}
`;

  const copyCode = () => {
    navigator.clipboard?.writeText(samplePythonCode);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl rounded-2xl bg-[#14131c] border border-[#2e2a40] shadow-2xl p-7 z-10 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-[#242131]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#211a36] text-[#b886fd]">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Configuração do Backend FastAPI
              </h2>
              <p className="text-xs text-[#9d9aa8]">
                Endereço do motor local de sincronização
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#858194] hover:text-white hover:bg-[#201e2c] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-white mb-1.5">
              URL Base do FastAPI (Local)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000"
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#1a1824] border border-[#a855f7]/60 font-mono text-xs text-white focus:outline-none focus:border-[#b886fd]"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-4 py-2.5 text-xs font-bold rounded-xl bg-[#211a36] hover:bg-[#2c2347] text-[#d8b4fe] border border-[#a855f7]/40 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                {testing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#b886fd]" />
                ) : (
                  <Server className="w-3.5 h-3.5 text-[#b886fd]" />
                )}
                <span>Testar Ping</span>
              </button>
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                testResult.ok
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-[#21192e] border-[#a855f7]/30 text-[#d8b4fe]'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#b886fd] shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <span className="font-semibold block">{testResult.message}</span>
                {!testResult.ok && (
                  <span className="text-[11px] text-[#9d9aa8] block mt-0.5">
                    O WebSync continuará operando com simulação visual interativa enquanto o FastAPI não estiver rodando.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Quick Python snippet */}
          <div className="pt-2 border-t border-[#242131]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#b886fd] flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5" /> Rotas FastAPI Prontas
              </span>
              <button
                onClick={copyCode}
                className="text-[11px] text-[#d8b4fe] hover:text-white font-semibold flex items-center gap-1 cursor-pointer"
              >
                {copiedSnippet ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Copiar Código
                  </>
                )}
              </button>
            </div>

            <div className="max-h-36 overflow-y-auto rounded-xl bg-[#0b0a10] p-3 border border-[#2b273d] font-mono text-[11px] text-[#bda8e6] leading-normal">
              <pre>{samplePythonCode}</pre>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#242131]">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-[#9d9aa8] hover:text-white bg-[#1b1926] hover:bg-[#252236] border border-[#2e2a40] rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 text-xs font-extrabold text-black bg-[#b886fd] hover:bg-[#c99eff] active:bg-[#a770fa] rounded-xl shadow-lg shadow-purple-950/60 transition-colors cursor-pointer"
            >
              Salvar Configuração
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
