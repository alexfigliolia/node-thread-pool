import type { Transferable } from "node:worker_threads";
import { Worker } from "node:worker_threads";

import type { AbstractTask, WorkerResponse } from "../shared";
import { AbstractThread, AbstractWorkerResolver } from "../shared";

import { Task } from "./Task";

/**
 * Thread
 *
 * A wrapper around the `node:worker_threads.Worker` supporting type-safe
 * operations, concurrency limits, and automatic shut down
 */
export class Thread<Args, Result> extends AbstractThread<
  Args,
  Result,
  readonly Transferable[],
  Worker,
  WorkerResponse<Result>,
  Task<Args, Result>
> {
  protected override terminateWorker() {
    return this.Worker.terminate().then(() => {});
  }

  protected override spawnWorker() {
    const worker = new Worker(
      this.configuration.workerScript,
      this.workerOptions,
    );
    worker.on("message", message => {
      const response = this.deriveResponse(message);
      this.Emitter.emit(response.ID, response);
    });
    worker.on("error", error => {
      for (const [ID] of this.outstandingTasks) {
        this.Emitter.emit(ID, AbstractWorkerResolver.error(ID, error));
      }
      void this.terminateWorker();
      this.internallyTerminate(() => {
        this.respawn();
      });
    });
    return worker;
  }

  protected override createTask(
    ...args: ConstructorParameters<
      typeof AbstractTask<
        Args,
        Result,
        readonly Transferable[],
        Worker,
        WorkerResponse<Result>
      >
    >
  ) {
    return new Task<Args, Result>(...args);
  }

  protected override deriveResponse(message: WorkerResponse<Result>) {
    return message;
  }

  private internallyTerminate(callback: () => void) {
    if (this.killPromise) {
      return;
    }
    void this.runForcedShutDownProtocol(false);
    callback();
  }
}
