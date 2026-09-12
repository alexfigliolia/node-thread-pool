import type { WorkerArgs } from "../shared";
import { AbstractThreadPoolWorker } from "../shared";

import { WorkerResolver } from "./WorkerResolver";
import type { WebWorkerEvent } from "./types";

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
> extends AbstractThreadPoolWorker<
  WorkerArgs<Args>,
  WebWorkerEvent<Args>,
  Result,
  WorkerResolver<Result>
> {
  protected override listenToPort(
    callback: (event: WebWorkerEvent<Args>) => void,
  ) {
    return self.addEventListener("message", callback);
  }

  protected override getTaskID(args: WorkerArgs<Args>) {
    return args.__WORKER_POOL_ID__;
  }

  protected override deriveArgs(args: WebWorkerEvent<Args>) {
    return args.data;
  }

  protected override createResolver(ID: string) {
    return new WorkerResolver<Result>(ID);
  }
}
