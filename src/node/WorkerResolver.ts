import { parentPort, type Transferable } from "node:worker_threads";

import { AbstractWorkerResolver, type WorkerResponse } from "../shared";

/**
 * Worker Resolver
 *
 * Normalizes inter-thread communication by wrapping
 * results and errors along with the task's ID.
 */
export class WorkerResolver<
  Result,
  Error = unknown,
> extends AbstractWorkerResolver<Result, readonly Transferable[], Error> {
  protected respond(
    result: WorkerResponse<Result, Error>,
    transferables?: readonly Transferable[],
  ) {
    parentPort?.postMessage(result, transferables);
  }
}
