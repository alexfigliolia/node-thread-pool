import { AbstractThreadPoolWorker } from "../shared";

import { WorkerResolver } from "./WorkerResolver";
import type { WebWorkerEvent } from "./types";

/**
 * Thread Pool Worker
 *
 * A wrapper around worker-thread message transport. Pass
 * your multi-threaded logic as a callback to the constructor
 * and it'll take care of the rest.
 *
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
  WebWorkerEvent<Args>,
  Result,
  WorkerResolver<Result>
> {
  protected override listenToPort(
    callback: (event: WebWorkerEvent<Args>) => void,
  ) {
    return self.addEventListener("message", callback);
  }

  protected override deriveArgs(args: WebWorkerEvent<Args>) {
    return args.data;
  }

  protected override createResolver(ID: string) {
    return new WorkerResolver<Result>(ID);
  }
}
