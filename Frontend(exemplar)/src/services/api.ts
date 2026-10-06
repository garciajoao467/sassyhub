import { SyncClient, LogEntry } from '../types';

export const INITIAL_CLIENTS: SyncClient[] = [
  {
    id: 'client-1',
    name: 'Sassy Square — Brand Assets',
    sourcePath: '/Volumes/Design/Clients/SassySquare/FinalMedia',
    destinationPath: 's3://cloud-sync-storage/sassysquare/assets/production',
    autoSync: true,
    status: 'synced',
    lastSyncAt: '2026-10-04T02:18:22Z',
    nextSyncAt: '2026-10-04T02:33:22Z',
    intervalMinutes: 15,
    excludePatterns: '*.tmp, .DS_Store, .git, *node_modules*',
    stats: {
      filesCount: 4820,
    },
  },
  {
    id: 'client-2',
    name: 'Nexus E-Commerce — Product Media',
    sourcePath: '/srv/fastapi/storage/nexus/products/high-res',
    destinationPath: '/mnt/backup_nas/vault/nexus/catalog_2026',
    autoSync: true,
    status: 'syncing',
    lastSyncAt: '2026-10-04T02:24:10Z',
    nextSyncAt: null,
    intervalMinutes: 5,
    excludePatterns: '*.cache, *.log, thumbs.db',
    stats: {
      filesCount: 12450,
      progressPercent: 68,
      speedMbps: 42.8,
    },
  },
  {
    id: 'client-3',
    name: 'Studio Vanguarda — Video Renders',
    sourcePath: 'D:\\Projetos\\RenderFarm\\Vanguarda_4K_Export',
    destinationPath: 's3://media-vault-us-east-1/archive/vanguarda/masters',
    autoSync: false,
    status: 'paused',
    lastSyncAt: '2026-10-03T19:40:00Z',
    nextSyncAt: null,
    intervalMinutes: 60,
    excludePatterns: '*.prproj.tmp, *Scratch*',
    stats: {
      filesCount: 890,
    },
  },
  {
    id: 'client-4',
    name: 'Banco Aurora — Database Dumps',
    sourcePath: '/var/backups/aurora_pg_daily',
    destinationPath: 's3://aurora-encrypted-backups/daily/fastapi-engine',
    autoSync: true,
    status: 'synced',
    lastSyncAt: '2026-10-04T01:00:15Z',
    nextSyncAt: '2026-10-05T01:00:00Z',
    intervalMinutes: 1440,
    excludePatterns: '*.lock, *.pid',
    stats: {
      filesCount: 24,
    },
  },
  {
    id: 'client-5',
    name: 'Atlas Logística — NFe & Comprovantes',
    sourcePath: 'C:\\Atlas\\Docs\\Faturamento_2026\\Emitidas',
    destinationPath: '\\\\srv-filecluster.local\\financeiro\\nfe_backup',
    autoSync: false,
    status: 'paused',
    lastSyncAt: '2026-10-04T02:05:12Z',
    nextSyncAt: null,
    intervalMinutes: 15,
    excludePatterns: '*.temp, ~*.*',
    stats: {
      filesCount: 3410,
    },
  },
  {
    id: 'client-6',
    name: 'Lumina Fotografia — RAW Library',
    sourcePath: '/Volumes/SSD_SanDisk/Lumina/Campanhas_Outono',
    destinationPath: 's3://lumina-creative-cloud/photobackups/fall2026',
    autoSync: true,
    status: 'synced',
    lastSyncAt: '2026-10-04T02:10:00Z',
    nextSyncAt: '2026-10-04T02:40:00Z',
    intervalMinutes: 30,
    excludePatterns: '*.cr3.xmp, .Spotlight-V100',
    stats: {
      filesCount: 520,
    },
  },
];

export const MOCK_LOGS: Record<string, LogEntry[]> = {
  'client-1': [
    {
      id: 'log-1-1',
      timestamp: '02:18:22.104',
      level: 'SUCCESS',
      message: 'Ciclo de sincronização concluído com sucesso. 142 arquivos verificados.',
      details: 'Checksum MD5 validado em 142 itens. 0 alterações pendentes.',
    },
    {
      id: 'log-1-2',
      timestamp: '02:18:19.450',
      level: 'INFO',
      message: 'Upload concluído: final_banner_sassysquare_4k.mp4',
      details: 'Destino: s3://cloud-sync-storage/sassysquare/assets/production/final_banner_sassysquare_4k.mp4',
    },
    {
      id: 'log-1-3',
      timestamp: '02:18:05.120',
      level: 'INFO',
      message: 'Iniciando verificação de delta com S3 bucket s3://cloud-sync-storage...',
    },
  ],
  'client-2': [
    {
      id: 'log-2-1',
      timestamp: '02:24:45.310',
      level: 'INFO',
      message: 'Transferindo lote [32/47]: camera_sony_fx3_angle_04.raw',
      details: 'Taxa média: 42.8 MB/s · ETA: 48s',
    },
    {
      id: 'log-2-2',
      timestamp: '02:24:28.109',
      level: 'INFO',
      message: 'Submetido bloco de 12 arquivos para o NAS de contingência.',
    },
    {
      id: 'log-2-3',
      timestamp: '02:24:10.002',
      level: 'INFO',
      message: 'Watcher detectou modificação em /srv/fastapi/storage/nexus/products/high-res',
      details: 'Trigger: inotify IN_CLOSE_WRITE disparado pelo FastAPI Engine.',
    },
  ],
  'client-3': [
    {
      id: 'log-3-1',
      timestamp: '19:40:00.012',
      level: 'WARN',
      message: 'Sincronização automática pausada pelo operador.',
      details: 'Processamento retido na coluna de Inativos.',
    },
  ],
};

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
      const res = await fetch(`${this.baseUrl}/health`, { credentials: 'omit', signal: controller.signal });
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

  async forceSync(clientId: string): Promise<boolean> {
    console.log(`[SyncEngine API] POST /api/clients/${clientId}/sync`);
    try {
      await fetch(`${this.baseUrl}/api/clients/${clientId}/sync`, { method: 'POST' });
    } catch {}
    return true;
  }

  async toggleAutoSync(clientId: string, autoSync: boolean): Promise<boolean> {
    console.log(`[SyncEngine API] PATCH /api/clients/${clientId}/autosync`, { autoSync });
    try {
      await fetch(`${this.baseUrl}/api/clients/${clientId}/autosync`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSync }),
      });
    } catch {}
    return true;
  }

  async createClient(data: Partial<SyncClient>): Promise<boolean> {
    console.log('[SyncEngine API] POST /api/clients', data);
    try {
      await fetch(`${this.baseUrl}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {}
    return true;
  }

  async updateClient(clientId: string, data: Partial<SyncClient>): Promise<boolean> {
    console.log(`[SyncEngine API] PUT /api/clients/${clientId}`, data);
    try {
      await fetch(`${this.baseUrl}/api/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {}
    return true;
  }

  async deleteClient(clientId: string): Promise<boolean> {
    console.log(`[SyncEngine API] DELETE /api/clients/${clientId}`);
    try {
      await fetch(`${this.baseUrl}/api/clients/${clientId}`, { method: 'DELETE' });
    } catch {}
    return true;
  }
}

export const syncApiService = new SyncApiService();
