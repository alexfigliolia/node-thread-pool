import type { AbstractTask, IWorkerResult, WorkerArgs } from "../shared";
import { AbstractThread } from "../shared";

import type { WebWorkerResult } from "./types";
import { Task } from "./Task";

/**
 * Thread
 *
 * A wrapper around the browser's `Worker` supporting type-safe
 * operations, concurrency limits, and automatic shut down
 */
export class Thread<
  Args extends Record<string, any>,
  Result,
> extends AbstractThread<
  Args,
  Result,
  Worker,
  WebWorkerResult<Result>,
  Task<Args, Result>
> {
  public override internallyPostMessage(args: WorkerArgs<Args>) {
    this.Worker.postMessage(args);
  }

  public override internallySubscribe(
    onMessage: (message: WebWorkerResult<Result>) => void,
    onError: (error: ErrorEvent) => void,
  ) {
    this.Worker.addEventListener("message", onMessage);
    this.Worker.addEventListener("error", onError);
    return () => {
      this.Worker.removeEventListener("message", onMessage);
      this.Worker.removeEventListener("error", onError);
    };
  }

  protected override terminateWorker() {
    return Promise.resolve(this.Worker.terminate());
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
