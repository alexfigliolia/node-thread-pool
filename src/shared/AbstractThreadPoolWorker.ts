import type { WorkerRequest } from "./types";
import {
  TaskType,
  type TaskArgs,
  type ThreadPoolWorkerOperation,
} from "./types";
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
      const resolver = this.createResolver(args.ID);
      switch (args.type) {
        case TaskType.TASK:
          this.unwrapAndCatch(operation, resolver, args);
          break;
        case TaskType.PING:
          resolver.ping(this.getTime() - args.time);
          break;
      }
    });
  }

  protected abstract listenToPort(callback: (event: Event) => void): void;

  protected abstract deriveArgs(args: Event): WorkerRequest<Args>;

  protected abstract createResolver(ID: string): Resolver;

  protected abstract getTime(): number;

  private unwrapAndCatch(
    operation: ThreadPoolWorkerOperation<Args, Result>,
    resolver: Resolver,
    args: TaskArgs<Args>,
  ) {
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
