import { AbstractTask } from "../shared";

import type {
  WebWorkerResolvedError,
  WebWorkerResolvedResult,
  WebWorkerResult,
} from "./types";

/**
 * Task
 *
 * A wrapper around a threaded task. With a reference to it,
 * you can await the result of it's operation or query its status
 */
export class Task<
  Args extends Record<string, any>,
  Result,
> extends AbstractTask<Args, Result, Worker, WebWorkerResult<Result>> {
  protected override deriveResult(message: WebWorkerResolvedResult<Result>) {
    return message.data.result;
  }

  protected deriveError(message: WebWorkerResolvedError<unknown>) {
    return message.data.error;
  }

  protected override isError(message: WebWorkerResult<Result>) {
    return "error" in message.data;
  }

  protected override matchTask(message: WebWorkerResult<Result>) {
    return message.data.__WORKER_POOL_ID__ === this.ID;
  }
}
