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
   * A timeout for tasks spawned on a thread. Using this threshold, an enqueued task's promise will reject if not complete
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

export interface ITask<Args> {
  ID: string;
  args: Args;
  taskTimeoutThreshold?: number;
}

export type WithTaskID<T extends Record<string, any>> = T & {
  ID: string;
};

export type WithTask<T extends Record<string, any>> = WithTaskID<T> & {
  type: TaskType.TASK;
};

export type WithPing<T extends Record<string, any>> = WithTaskID<T> & {
  type: TaskType.PING;
};

export type TaskArgs<Args> = WithTask<{ args: Args }>;

export type PingArgs = WithPing<{ time: number }>;

export enum TaskStatus {
  FAILED = "failed",
  PENDING = "pending",
  SUCCEEDED = "succeeded",
}

export enum TaskType {
  TASK = "task",
  PING = "ping",
}

export type WorkerTaskResult<Result> = WithTask<{ result: Result }>;

export type WorkerTaskError<Error = unknown> = WithTask<{ error: Error }>;

export type WorkerTaskResponse<Result, Error = unknown> =
  | WorkerTaskResult<Result>
  | WorkerTaskError<Error>;

export type WorkerPingResponse = WithPing<{
  time: number;
}>;

export type WorkerResponse<Result, Error = unknown> =
  | WorkerTaskResponse<Result, Error>
  | WorkerPingResponse;

export type WorkerRequest<Args> = PingArgs | TaskArgs<Args>;

export type EventStream<Result, Error = unknown> = Record<
  string,
  [WorkerResponse<Result, Error>]
>;

export type ThreadPoolWorkerOperation<Args, Result> = (
  args: Args,
) => Result | Promise<Result>;
