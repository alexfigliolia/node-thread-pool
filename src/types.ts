export interface IThreadOptions {
  maxConcurrency?: number;
  workerScript: string | URL;
  threadIdleTimeout?: number;
  taskTimeoutThreshold?: number;
}

export interface IThreadPool extends IThreadOptions {
  lazySpawnThreads?: boolean;
  totalThreads?: number;
}

export interface IThread extends IThreadOptions {
  workerScript: string | URL;
  onDestroy?: () => void;
}

export type WorkerArgs<T extends Record<string, any>> = T & {
  __WORKER_POOL_ID__: string;
};

export enum TaskStatus {
  FAILED = "failed",
  PENDING = "pending",
  SUCCEEDED = "succeeded",
}
