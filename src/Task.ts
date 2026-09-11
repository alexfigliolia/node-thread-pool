import type { Worker } from "node:worker_threads";

import { AutoIncrementingID } from "@figliolia/event-emitter";

import type { WorkerArgs, WorkerError } from "./types";

export class Task<
  Args extends Record<string, any>,
  Result extends Record<string, any>,
> {
  public readonly ID: string;
  private static readonly IDs = new AutoIncrementingID();
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    public readonly args: Args,
    public readonly timeoutThreshold?: number,
  ) {
    this.ID = Task.IDs.get();
  }

  public run(worker: Worker) {
    const workerArgs = this.toWorkerArgs(this.args);
    const { resolve, reject, promise } =
      Promise.withResolvers<WorkerArgs<Result>>();
    const onMessage = this.onMessage(workerArgs, resolve);
    const onError = this.onError(workerArgs, reject);
    worker.on("message", onMessage);
    worker.on("error", onError);
    const OFF = () => {
      this.killTimer();
      worker.off("message", onMessage);
      worker.off("error", onError);
    };
    this.configureTimeout(onError);
    worker.postMessage(workerArgs);
    return promise.finally(OFF);
  }

  private configureTimeout(onError: (error: WorkerError) => void) {
    if (
      typeof this.timeoutThreshold === "number" &&
      isFinite(this.timeoutThreshold)
    ) {
      this.timer = setTimeout(() => {
        onError(this.toWorkerArgs({ reason: "Task timed out" }));
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

  private onMessage(
    workerArgs: WorkerArgs<Args>,
    resolve: (
      value: WorkerArgs<Result> | PromiseLike<WorkerArgs<Result>>,
    ) => void,
  ) {
    return (data: WorkerArgs<Result>) => {
      if (data.__WORKER_POOL_ID__ === workerArgs.__WORKER_POOL_ID__) {
        resolve(data);
      }
    };
  }

  private onError(
    workerArgs: WorkerArgs<Args>,
    reject: (reason?: any) => void,
  ) {
    return (error: WorkerError) => {
      if (error.__WORKER_POOL_ID__ === workerArgs.__WORKER_POOL_ID__) {
        reject(error);
      }
    };
  }
}
