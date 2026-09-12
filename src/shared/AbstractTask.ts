import { AutoIncrementingID } from "@figliolia/event-emitter";

import { WorkerResolver } from "./WorkerResolver";
import { TaskStatus } from "./types";
import type { AbstractWorker } from "./AbstractWorker";
import type { AbstractThread } from "./AbstractThread";

/**
 * Task
 *
 * A wrapper around a threaded task. With a reference to it,
 * you can await the result of it's operation or query its status
 */
export abstract class AbstractTask<
  Args extends Record<string, any>,
  Result,
  WorkerType extends AbstractWorker<any>,
  IncomingMessage extends Record<string, any>,
> {
  public readonly ID: string;
  public status = TaskStatus.PENDING;
  private static readonly IDs = new AutoIncrementingID();
  public readonly resolvers: PromiseWithResolvers<Result>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    public readonly args: Args,
    public readonly timeoutThreshold?: number,
  ) {
    this.ID = AbstractTask.IDs.get();
    this.resolvers = Promise.withResolvers();
  }

  public run(
    thread: AbstractThread<
      Args,
      Result,
      WorkerType,
      IncomingMessage,
      typeof this
    >,
  ) {
    const workerArgs = this.toWorkerArgs(this.args);
    const subscriber = thread.internallySubscribe(
      this.onMessage,
      this.onError(thread),
    );
    const OFF = () => {
      this.killTimer();
      subscriber();
    };
    this.configureTimeout();
    thread.internallyPostMessage(workerArgs);
    return this.resolvers.promise.finally(OFF);
  }

  public reject(error: string) {
    this.resolvers.reject(WorkerResolver.from(this.ID).error(error));
  }

  protected abstract deriveResult(message: IncomingMessage): Result;

  protected abstract deriveError(message: IncomingMessage): unknown;

  protected abstract isError(message: IncomingMessage): boolean;

  protected abstract matchTask(message: IncomingMessage): boolean;

  private configureTimeout() {
    if (
      typeof this.timeoutThreshold === "number" &&
      isFinite(this.timeoutThreshold)
    ) {
      this.timer = setTimeout(() => {
        this.reject("Task timed out");
      }, this.timeoutThreshold);
    }
  }

  private killTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private toWorkerArgs<T extends Record<string, any>>(args: T) {
    return { ...args, __WORKER_POOL_ID__: this.ID };
  }

  private readonly onMessage = (data: IncomingMessage) => {
    if (this.matchTask(data)) {
      if (this.isError(data)) {
        this.status = TaskStatus.FAILED;
        this.resolvers.reject(this.deriveError(data));
      } else {
        this.status = TaskStatus.SUCCEEDED;
        this.resolvers.resolve(this.deriveResult(data));
      }
    }
  };

  private onError(
    thread: AbstractThread<
      Args,
      Result,
      WorkerType,
      IncomingMessage,
      typeof this
    >,
  ) {
    return (error: Error | ErrorEvent) => {
      this.status = TaskStatus.FAILED;
      thread.isDead = true;
      this.resolvers.reject(error);
    };
  }
}
