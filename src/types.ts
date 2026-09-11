export interface IThreadOptions {
  /**
   * maxConcurrency
   *
   * The maximum number of concurrent tasks allowed on a given thread
   *
   * Defaults to `Infinity`
   */
  maxConcurrency?: number;
  /**
   * workerScript
   *
   * The file path or URL to your worker script containing a `ThreadPoolWorker` instance
   */
  workerScript: string | URL;
  /**
   * threadIdleTimeout
   *
   * A threshold of milliseconds a thread should wait before shutting down when idle
   *
   * Defaults to `2000`
   */
  threadIdleTimeout?: number;
  /**
   * taskTimeoutThreshold
   *
   * A timeout for tasks spawned on a thread. Using this threshold, your enqueued task's promise will reject if not complete
   * within the duration of the threshold
   *
   * Defaults to `Infinity`
   */
  taskTimeoutThreshold?: number;
}

export interface IThreadPool extends IThreadOptions {
  /**
   * lazySpawnThreads
   *
   * Whether threads in the pool should spawn as needed based on the pool's task throughput.
   *
   * When false, a thread for each of the number of `totalThreads` will be pre-allocated
   *
   * Defaults to `true`
   */
  lazySpawnThreads?: boolean;
  /**
   * totalThreads
   *
   * Whether threads in the pool should spawn as needed based on the pool's task throughput.
   *
   * When false, a thread for each of the number of `totalThreads` will be pre-allocated
   *
   * Defaults to the half the number of CPU cores
   */
  totalThreads?: number;
}

export interface IThread extends IThreadOptions {
  /**
   * onDestroy
   *
   * An optional callback to run when a thread is shut down
   */
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
