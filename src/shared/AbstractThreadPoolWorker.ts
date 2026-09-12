import type { AbstractWorkerResolver } from "./AbstractWorkerResolver";

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
  Resolver extends AbstractWorkerResolver<Result, any>,
> {
  constructor(
    operation: (
      args: Args,
      resolve: Resolver["resolve"],
      reject: Resolver["reject"],
    ) => void | Promise<void>,
  ) {
    this.listenToPort((data: Event) => {
      const args = this.deriveArgs(data);
      const resolver = this.createResolver(this.getTaskID(args));
      void operation(args, resolver.resolve, resolver.reject);
    });
  }

  protected abstract listenToPort(callback: (event: Event) => void): void;

  protected abstract getTaskID(args: Args): string;

  protected abstract deriveArgs(args: Event): Args;

  protected abstract createResolver(ID: string): Resolver;
}
