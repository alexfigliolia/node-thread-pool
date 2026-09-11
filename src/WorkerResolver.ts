export class WorkerResolver<T, E = unknown> {
  constructor(public readonly __WORKER_POOL_ID__: string) {}

  public static from<T, E = unknown>(__WORKER_POOL_ID__: string) {
    return new WorkerResolver<T, E>(__WORKER_POOL_ID__);
  }

  public resolve(result: T) {
    return { __WORKER_POOL_ID__: this.__WORKER_POOL_ID__, result };
  }

  public error(error: E) {
    return { __WORKER_POOL_ID__: this.__WORKER_POOL_ID__, error };
  }
}

export type IWorkerResult<T, E> =
  | ReturnType<WorkerResolver<T, E>["resolve"]>
  | ReturnType<WorkerResolver<T, E>["error"]>;
