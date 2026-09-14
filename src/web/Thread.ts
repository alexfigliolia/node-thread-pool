import { AbstractThread } from "../shared";

import type { WebWorkerResponse } from "./types";
import { Task } from "./Task";
import { Ping } from "./Ping";

/**
 * Thread
 *
 * A wrapper around the browser's `Worker` supporting type-safe
 * operations, concurrency limits, and automatic shut down
 */
export class Thread<Args, Result> extends AbstractThread<
  Args,
  Result,
  StructuredSerializeOptions,
  Worker,
  WebWorkerResponse<Result>,
  Task<Args, Result>,
  Ping
> {
  protected override terminateWorker() {
    return Promise.resolve(this.Worker.terminate());
  }

  protected override spawnWorker() {
    const worker = new Worker(this.options.workerScript, this.workerOptions);
    worker.addEventListener("message", message => {
      const response = this.deriveResponse(message);
      this.Emitter.emit(response.ID, response);
    });
    return worker;
  }

  protected override deriveResponse(message: WebWorkerResponse<Result>) {
    return message.data;
  }

  protected override createTask(
    ...args: ConstructorParameters<typeof Task<Args, Result>>
  ) {
    return new Task<Args, Result>(...args);
  }

  protected override createPing(...args: ConstructorParameters<typeof Ping>) {
    return new Ping(...args);
  }
}
