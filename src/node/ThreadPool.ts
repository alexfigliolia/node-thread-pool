import type { Transferable, Worker, WorkerOptions } from "node:worker_threads";

import { AbstractThreadPool, type WorkerResponse } from "../shared";

import { Thread } from "./Thread";
import type { Task } from "./Task";
import type { Ping } from "./Ping";
import { Defaults } from "./Defaults";

/**
 * Thread Pool
 *
 * A pool of (lazily or pre)-allocated threads from which to load
 * balance any number of multithreaded operations. The pool will
 * automatically loadbalance tasks, greedily shut down threads,
 * support max-concurrency per thread, and allow for type-safe
 * multi-threaded operations.
 */
export class ThreadPool<Args, Result> extends AbstractThreadPool<
  Args,
  Result,
  readonly Transferable[],
  WorkerOptions,
  Worker,
  WorkerResponse<Result>,
  Task<Args, Result>,
  Ping,
  Thread<Args, Result>
> {
  public static override readonly Defaults = Defaults;

  protected override spawn(
    ...args: ConstructorParameters<typeof Thread<Args, Result>>
  ) {
    return new Thread<Args, Result>(...args);
  }
}
