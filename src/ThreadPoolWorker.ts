import { parentPort } from "node:worker_threads";

import type { IWorkerResult } from "./WorkerResolver";
import { WorkerResolver } from "./WorkerResolver";
import { type WorkerArgs } from "./types";

/**
 * Thread Pool Worker
 *
 * A wrapper around worker-thread message transport. Pass
 * your multi-threaded logic as a callback to the constructor
 * and it'll take care of the rest.
 */
export class ThreadPoolWorker<Args extends Record<string, any>, Result> {
  constructor(operation: (args: Args) => Result | Promise<Result>) {
    parentPort?.on("message", (data: WorkerArgs<Args>) => {
      const resolver = new WorkerResolver<Result>(data.__WORKER_POOL_ID__);
      try {
        const result = operation(data);
        if (result instanceof Promise) {
          void result
            .then(v => this.respond(resolver.resolve(v)))
            .catch(error => this.respond(resolver.error(error)));
        } else {
          this.respond(resolver.resolve(result));
        }
      } catch (error: unknown) {
        this.respond(resolver.error(error));
      }
    });
  }

  private respond(result: IWorkerResult<Result, unknown>) {
    parentPort?.postMessage(result);
  }
}
