import { parentPort } from "node:worker_threads";

import type { IWorkerResult, WorkerArgs } from "../shared";
import { AbstractThreadPoolWorker } from "../shared";

/**
 * Thread Pool Worker
 *
 * A wrapper around worker-thread message transport. Pass
 * your multi-threaded logic as a callback to the constructor
 * and it'll take care of the rest.
 */
export class ThreadPoolWorker<
  Args extends Record<string, any>,
  Result,
> extends AbstractThreadPoolWorker<WorkerArgs<Args>, WorkerArgs<Args>, Result> {
  protected override listenToPort(callback: (event: WorkerArgs<Args>) => void) {
    return parentPort?.on("message", callback);
  }

  protected override getTaskID(args: WorkerArgs<Args>) {
    return args.__WORKER_POOL_ID__;
  }

  protected override deriveArgs(args: WorkerArgs<Args>) {
    return args;
  }

  protected override respond(result: IWorkerResult<Result, unknown>) {
    parentPort?.postMessage(result);
  }
}
