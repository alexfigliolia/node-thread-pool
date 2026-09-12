import type { WorkerArgs } from "./types";

/**
 * Worker Resolver
 *
 * Normalizes inter-thread communication by wrapping
 * results and errors along with the task's ID.
 */
export abstract class AbstractWorkerResolver<
  Result,
  OptionsOrTransferrables,
  Error = unknown,
> {
  constructor(public readonly __WORKER_POOL_ID__: string) {}

  /**
   * Resolve
   *
   * Responds to the main thread with your result
   */
  public readonly resolve = (
    result: Result,
    options?: OptionsOrTransferrables,
  ) => {
    return this.respond(
      { __WORKER_POOL_ID__: this.__WORKER_POOL_ID__, result },
      options,
    );
  };

  /**
   * Reject
   *
   * Responds to the main thread with an error
   */
  public readonly reject = (
    error: Error,
    options?: OptionsOrTransferrables,
  ) => {
    return this.respond(
      AbstractWorkerResolver.error(this.__WORKER_POOL_ID__, error),
      options,
    );
  };

  public static error<E = unknown>(ID: string, error: E) {
    return { __WORKER_POOL_ID__: ID, error };
  }

  protected abstract respond(
    result: IWorkerResult<Result, Error>,
    options?: OptionsOrTransferrables,
  ): void;
}

export type IWorkerResolvedResult<T> = WorkerArgs<{ result: T }>;

export type IWorkerResolvedError<E> = WorkerArgs<{ error: E }>;

export type IWorkerResult<T, E> =
  | IWorkerResolvedResult<T>
  | IWorkerResolvedError<E>;
