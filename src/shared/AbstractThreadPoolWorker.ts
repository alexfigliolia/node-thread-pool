import type { IWorkerResult } from "./WorkerResolver";
import { WorkerResolver } from "./WorkerResolver";

/**
 * Thread Pool Worker
 *
 * A wrapper around worker-thread message transport. Pass
 * your multi-threaded logic as a callback to the constructor
 * and it'll take care of the rest.
 */
export abstract class AbstractThreadPoolWorker<
  Args extends Record<string, any>,
  Event extends Record<string, any>,
  Result,
> {
  constructor(operation: (args: Args) => Result | Promise<Result>) {
    this.listenToPort((data: Event) => {
      const args = this.deriveArgs(data);
      const resolver = new WorkerResolver<Result>(this.getTaskID(args));
      try {
        const result = operation(args);
        if (result instanceof Promise) {
          void result
            .then(v => this.respond(resolver.resolve(v)))
            .catch(error => this.respond(resolver.error(error)));
        } else {
          this.respond(resolver.resolve(result));
        }
      } catch (error: unknown) {
        this.respond(resolver.error(error));
      }
    });
  }

  protected abstract listenToPort(callback: (event: Event) => void): void;

  protected abstract getTaskID(args: Args): string;

  protected abstract deriveArgs(args: Event): Args;

  protected abstract respond(result: IWorkerResult<Result, unknown>): void;
}
