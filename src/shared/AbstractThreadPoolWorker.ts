import type { TaskArgs, ThreadPoolWorkerOperation } from "./types";
import type { AbstractWorkerResolver } from "./AbstractWorkerResolver";

/**
 * Thread Pool Worker
 *
 * A wrapper around worker-thread message transport. Pass
 * your multi-threaded logic as a callback to the constructor
 * and it'll take care of the rest.
 */
export abstract class AbstractThreadPoolWorker<
  Args,
  Event extends Record<string, any>,
  Result,
  Resolver extends AbstractWorkerResolver<Result, any>,
> {
  constructor(operation: ThreadPoolWorkerOperation<Args, Result>) {
    this.listenToPort((data: Event) => {
      const args = this.deriveArgs(data);
      this.unwrapAndCatch(operation, args);
    });
  }

  protected abstract listenToPort(callback: (event: Event) => void): void;

  protected abstract deriveArgs(args: Event): TaskArgs<Args>;

  protected abstract createResolver(ID: string): Resolver;

  private unwrapAndCatch(
    operation: ThreadPoolWorkerOperation<Args, Result>,
    args: TaskArgs<Args>,
  ) {
    const resolver = this.createResolver(args.ID);
    try {
      const result = operation(args.args);
      if (result instanceof Promise) {
        void result.then(resolver.resolve).catch(resolver.reject);
      } else {
        resolver.resolve(result);
      }
    } catch (error) {
      resolver.reject(error);
    }
  }
}
