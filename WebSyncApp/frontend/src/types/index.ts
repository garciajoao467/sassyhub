export type SyncStatus = 'synced' | 'syncing' | 'paused' | 'error';

export interface SyncClient {
  id: string;
  name: string;
  sourcePath: string;
  destinationPath: string;
  autoSync: boolean;
  status: SyncStatus;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  intervalMinutes: number; // 0 = real-time / watcher
  excludePatterns: string;
  stats: {
    filesCount: number;
    speedMbps?: number;
    progressPercent?: number;
  };
}

export type LogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: string;
}

export interface EngineStats {
  daemonStatus: 'running' | 'idle' | 'warning' | 'stopped';
  fastApiConnected: boolean;
  fastApiUrl: string;
  activeJobsCount: number;
  syncingNowCount: number;
  uptimeSeconds: number;
  lastHeartbeat: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
}
