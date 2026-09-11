export interface IWorkerPool {
  lazySpawnThreads?: boolean;
  workerScript: string | URL;
  maxConcurrency?: number;
  totalThreads?: number;
  taskTimeoutThreshold?: number;
  threadIdleTimeout?: number;
}

export interface IThread {
  workerScript: string | URL;
  onDestroy?: () => void;
  threadIdleTimeout: number;
  taskTimeoutThreshold?: number;
}

export type WorkerArgs<T extends Record<string, any>> = T & {
  __WORKER_POOL_ID__: string;
};

export type WorkerError = WorkerArgs<{ reason: string }>;
