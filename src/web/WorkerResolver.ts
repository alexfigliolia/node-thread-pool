import type { WorkerResponse } from "../shared";
import { AbstractWorkerResolver } from "../shared";

/**
 * Worker Resolver
 *
 * Normalizes inter-thread communication by wrapping
 * results and errors along with the task's ID.
 */
export class WorkerResolver<
  Result,
  Error = unknown,
> extends AbstractWorkerResolver<Result, WindowPostMessageOptions, Error> {
  protected override respond(
    result: WorkerResponse<Result, Error>,
    options?: WindowPostMessageOptions,
  ) {
    self.postMessage(result, options);
  }
}
