import { TaskType, type WorkerResponse, type WorkerTaskError } from "./types";

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
  constructor(public readonly ID: string) {}

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
      {
        ID: this.ID,
        result,
        type: TaskType.TASK,
      },
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
    return this.respond(AbstractWorkerResolver.error(this.ID, error), options);
  };

  /**
   * Ping
   *
   * Responds to the main thread's ping with a latency measure
   */
  public ping(latency: number) {
    return this.respond({
      ID: this.ID,
      time: latency,
      type: TaskType.PING,
    });
  }

  public static error<E = unknown>(ID: string, error: E): WorkerTaskError<E> {
    return { ID: ID, error, type: TaskType.TASK };
  }

  protected abstract respond(
    result: WorkerResponse<Result, Error>,
    options?: OptionsOrTransferrables,
  ): void;
}
