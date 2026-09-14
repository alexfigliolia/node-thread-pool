import { AbstractThreadPool } from "../shared";

import type { WebWorkerResponse } from "./types";
import { Thread } from "./Thread";
import type { Task } from "./Task";
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
  StructuredSerializeOptions,
  WorkerOptions,
  Worker,
  WebWorkerResponse<Result>,
  Task<Args, Result>,
  Thread<Args, Result>
> {
  public static override readonly Defaults = Defaults;

  protected override spawn(
    ...args: ConstructorParameters<typeof Thread<Args, Result>>
  ) {
    return new Thread<Args, Result>(...args);
  }
}
