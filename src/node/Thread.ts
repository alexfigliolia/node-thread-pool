import { Worker } from "node:worker_threads";

import type { AbstractTask, IWorkerResult, WorkerArgs } from "../shared";
import { AbstractThread } from "../shared";

import { Task } from "./Task";
import { Defaults } from "./Defaults";

/**
 * Thread
 *
 * A wrapper around the `node:worker_threads.Worker` supporting type-safe
 * operations, concurrency limits, and automatic shut down
 */
export class Thread<
  Args extends Record<string, any>,
  Result,
> extends AbstractThread<
  Args,
  Result,
  Worker,
  IWorkerResult<Result, unknown>,
  Task<Args, Result>
> {
  public static override readonly Defaults = Defaults;

  public override internallyPostMessage(args: WorkerArgs<Args>) {
    this.Worker.postMessage(args);
  }

  public override internallySubscribe(
    onMessage: (message: IWorkerResult<Result, unknown>) => void,
    onError: (error: Error) => void,
  ) {
    this.Worker.on("message", onMessage);
    this.Worker.on("error", onError);
    return () => {
      this.Worker.on("message", onMessage);
      this.Worker.on("error", onError);
    };
  }

  protected override terminateWorker() {
    return this.Worker.terminate().then(() => {});
  }

  protected override spawnWorker() {
    return new Worker(this.configuration.workerScript, this.workerOptions);
  }

  protected override createTask(
    ...args: ConstructorParameters<
      typeof AbstractTask<Args, Result, Worker, IWorkerResult<Result, unknown>>
    >
  ) {
    return new Task<Args, Result>(...args);
  }
}
