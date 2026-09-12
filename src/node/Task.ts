import type { Worker } from "node:worker_threads";

import type {
  IWorkerResolvedError,
  IWorkerResolvedResult,
  IWorkerResult,
} from "../shared";
import { AbstractTask } from "../shared";

/**
 * Task
 *
 * A wrapper around a threaded task. With a reference to it,
 * you can await the result of it's operation or query its status
 */
export class Task<
  Args extends Record<string, any>,
  Result,
> extends AbstractTask<Args, Result, Worker, IWorkerResult<Result, unknown>> {
  protected override deriveResult(message: IWorkerResolvedResult<Result>) {
    return message.result;
  }

  protected deriveError(message: IWorkerResolvedError<unknown>) {
    return message.error;
  }

  protected override isError(message: IWorkerResult<Result, unknown>) {
    return "error" in message;
  }

  protected override matchTask(message: IWorkerResult<Result, unknown>) {
    return message.__WORKER_POOL_ID__ === this.ID;
  }
}
