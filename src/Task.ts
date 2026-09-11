import { AutoIncrementingID } from "@figliolia/event-emitter";

import { WorkerResolver, type IWorkerResult } from "./WorkerResolver";
import { TaskStatus } from "./types";
import type { Thread } from "./Thread";

/**
 * Task
 *
 * A wrapper around a threaded task. With a reference to it,
 * you can await the result of it's operation or query its status
 */
export class Task<Args extends Record<string, any>, Result> {
  public readonly ID: string;
  public status = TaskStatus.PENDING;
  private static readonly IDs = new AutoIncrementingID();
  public readonly resolvers: PromiseWithResolvers<Result>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    public readonly args: Args,
    public readonly timeoutThreshold?: number,
  ) {
    this.ID = Task.IDs.get();
    this.resolvers = Promise.withResolvers();
  }

  public run(thread: Thread<Args, Result>) {
    const workerArgs = this.toWorkerArgs(this.args);
    const onMessage = this.onMessage(this.ID);
    const onError = this.onError(thread);
    thread.Worker.on("message", onMessage);
    thread.Worker.on("error", onError);
    const OFF = () => {
      this.killTimer();
      thread.Worker.off("message", onMessage);
      thread.Worker.off("error", onError);
    };
    this.configureTimeout();
    thread.Worker.postMessage(workerArgs);
    return this.resolvers.promise.finally(OFF);
  }

  public reject(error: string) {
    this.resolvers.reject(WorkerResolver.from(this.ID).error(error));
  }

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

  private onMessage(ID: string) {
    return (data: IWorkerResult<Result, Error>) => {
      if (data.__WORKER_POOL_ID__ === ID) {
        if ("error" in data) {
          this.status = TaskStatus.FAILED;
          this.resolvers.reject(data.error);
        } else {
          this.status = TaskStatus.SUCCEEDED;
          this.resolvers.resolve(data.result);
        }
      }
    };
  }

  private onError(thread: Thread<Args, Result>) {
    return (error: Error) => {
      if (!("__WORKER_POOL_ID__" in error)) {
        this.status = TaskStatus.FAILED;
        thread.isDead = true;
        this.resolvers.reject(error);
      }
    };
  }
}
