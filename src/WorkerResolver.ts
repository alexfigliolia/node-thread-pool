/**
 * Worker Resolver
 *
 * Normalizes inter-thread communication by wrapping
 * results and errors along with the task's ID.
 */
export class WorkerResolver<T, E = unknown> {
  constructor(public readonly __WORKER_POOL_ID__: string) {}

  /**
   * From
   *
   * Scopes a `WorkerResolver` to the specified task ID
   */
  public static from<T, E = unknown>(__WORKER_POOL_ID__: string) {
    return new WorkerResolver<T, E>(__WORKER_POOL_ID__);
  }

  /**
   * Resolve
   *
   * Creates a thread reponse object containing your resolved result
   */
  public resolve(result: T) {
    return { __WORKER_POOL_ID__: this.__WORKER_POOL_ID__, result };
  }

  /**
   * Error
   *
   * Creates a thread reponse object containing your error
   */
  public error(error: E) {
    return { __WORKER_POOL_ID__: this.__WORKER_POOL_ID__, error };
  }
}

export type IWorkerResult<T, E> =
  | ReturnType<WorkerResolver<T, E>["resolve"]>
  | ReturnType<WorkerResolver<T, E>["error"]>;
