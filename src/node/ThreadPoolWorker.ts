import { parentPort } from "node:worker_threads";

import type { TaskArgs } from "../shared";
import { AbstractThreadPoolWorker } from "../shared";

import { WorkerResolver } from "./WorkerResolver";

/**
 * Thread Pool Worker
 *
 * A wrapper around worker-thread message transport. Pass
 * your multi-threaded logic as a callback to the constructor
 * and it'll take care of the rest.
 * ```typescript
 * import { ThreadPoolWorker } from "@figliolia/thread-pool/web";
 *
 * new ThreadPoolWorker((args: YourTaskArgs) => {
 *   // your multi-threaded work
 *
 *   // return or throw the value you'd like to pass back
 *   // to the main thread
 * });
 * ```
 */
export class ThreadPoolWorker<Args, Result> extends AbstractThreadPoolWorker<
  Args,
  TaskArgs<Args>,
  Result,
  WorkerResolver<Result>
> {
  protected override listenToPort(callback: (event: TaskArgs<Args>) => void) {
    return parentPort?.on("message", callback);
  }

  protected override deriveArgs(args: TaskArgs<Args>): TaskArgs<Args> {
    return args;
  }

  protected createResolver(ID: string) {
    return new WorkerResolver<Result>(ID);
  }
}
