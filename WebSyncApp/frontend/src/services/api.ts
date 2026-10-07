import { SyncClient, LogEntry } from '../types';

export const INITIAL_CLIENTS: SyncClient[] = [];
export const MOCK_LOGS: Record<string, LogEntry[]> = {};

class SyncApiService {
  private baseUrl: string = 'http://127.0.0.1:8000';

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fastapi_base_url');
      if (saved) {
        this.baseUrl = saved;
      }
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
      localStorage.setItem('fastapi_base_url', this.baseUrl);
    }
  }

  async checkHealth(): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.baseUrl}/`, { credentials: 'omit', signal: controller.signal });
      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - start);
      if (res.ok) {
        return { ok: true, message: `FastAPI Online (${latencyMs}ms)`, latencyMs };
      }
      return { ok: false, message: `Status HTTP ${res.status}` };
    } catch {
      return { ok: false, message: `Offline / Conexão recusada em ${this.baseUrl}` };
    }
  }

  async getClients(): Promise<SyncClient[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/clientes/`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((c: any) => ({
        id: c.id,
        name: c.nome,
        sourcePath: c.pasta_origem,
        destinationPath: c.pasta_destino,
        autoSync: c.status_ativo,
        status: c.status_ativo ? 'synced' : 'paused',
        lastSyncAt: c.ultimo_sync ? (c.ultimo_sync.endsWith('Z') ? c.ultimo_sync : c.ultimo_sync + 'Z') : null,
        nextSyncAt: null,
        intervalMinutes: 15,
        excludePatterns: '',
        stats: { filesCount: 0 }
      }));
    } catch {
      return [];
    }
  }

  async getLogs(clientId: string): Promise<LogEntry[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/clientes/${clientId}/logs`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((l: any) => ({
        id: l.id,
        timestamp: new Date(l.data_hora).toISOString(),
        level: l.status_sucesso ? 'SUCCESS' : 'ERROR',
        message: l.mensagem || (l.status_sucesso ? 'Sucesso' : 'Erro'),
      }));
    } catch {
      return [];
    }
  }

  async forceSync(clientId: string): Promise<boolean> {
    try {
      await fetch(`${this.baseUrl}/api/clientes/${clientId}/sync-manual`, { method: 'POST' });
    } catch {}
    return true;
  }

  forceSyncStream(
    clientId: string,
    onProgress: (percent: number, speed: string) => void,
    onLog: (log: LogEntry) => void,
    onComplete: (success: boolean, errorMsg?: string) => void
  ): () => void {
    const eventSource = new EventSource(`${this.baseUrl}/api/clientes/${clientId}/sync-stream`);

    eventSource.onmessage = (event) => {
      const data = event.data;

      if (data.includes('[SYNC_CONCLUIDO]')) {
        onComplete(true);
        eventSource.close();
        return;
      }
      if (data.includes('[SYNC_ERRO]')) {
        const errorMsg = data.replace('[SYNC_ERRO]', '').trim();
        onComplete(false, errorMsg);
        eventSource.close();
        return;
      }

      if (data.includes('Transferred:') && data.includes('%')) {
        const percentMatch = data.match(/(\d+)%/);
        const speedMatch = data.match(/,\s*([\d.]+\s*[a-zA-Z]+\/s)/);
        
        let percent = 0;
        let speed = '';
        if (percentMatch) percent = parseInt(percentMatch[1], 10);
        if (speedMatch) speed = speedMatch[1];
        
        if (percent > 0 || speed) {
          onProgress(percent, speed);
        }
      }

      if (data.trim() && !data.includes('Transferred:') && !data.includes('Elapsed time:')) {
        onLog({
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: new Date().toISOString(),
          level: data.toLowerCase().includes('error') ? 'ERROR' : 'INFO',
          message: data.trim(),
        });
      }
    };

    eventSource.onerror = () => {
      onComplete(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }

  async forceSyncAll(): Promise<boolean> {
    try {
      await fetch(`${this.baseUrl}/api/clientes/sync-global`, { method: 'POST' });
    } catch {}
    return true;
  }

  async toggleAutoSync(clientId: string, autoSync: boolean): Promise<boolean> {
    try {
      await fetch(`${this.baseUrl}/api/clientes/${clientId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_ativo: autoSync }),
      });
    } catch {}
    return true;
  }

  async createClient(data: Partial<SyncClient>): Promise<any> {
    try {
      const res = await fetch(`${this.baseUrl}/api/clientes/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: data.name,
          pasta_origem: data.sourcePath,
          pasta_destino: data.destinationPath,
          status_ativo: data.autoSync ?? true
        }),
      });
      return await res.json();
    } catch {
      return null;
    }
  }

  async updateClient(clientId: string, data: Partial<SyncClient>): Promise<boolean> {
    try {
      await fetch(`${this.baseUrl}/api/clientes/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: data.name,
          pasta_origem: data.sourcePath,
          pasta_destino: data.destinationPath,
          status_ativo: data.autoSync
        }),
      });
    } catch {}
    return true;
  }

  async deleteClient(clientId: string): Promise<boolean> {
    try {
      await fetch(`${this.baseUrl}/api/clientes/${clientId}`, { method: 'DELETE' });
    } catch {}
    return true;
  }

  async getScheduleConfig(): Promise<{ sync_mode: string; sync_value: string }> {
    const response = await fetch(`${this.baseUrl}/api/config/`);
    if (!response.ok) {
      throw new Error('Falha ao buscar configurações de agendamento');
    }
    return response.json();
  }

  async updateScheduleConfig(config: { sync_mode: string; sync_value: string }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/config/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      throw new Error('Falha ao atualizar configurações de agendamento');
    }
  }
}

export const syncApiService = new SyncApiService();
