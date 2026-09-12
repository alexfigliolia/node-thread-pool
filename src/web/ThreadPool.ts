import { AbstractThreadPool } from "../shared";

import { type WebWorkerResult } from "./types";
import { Thread } from "./Thread";
import type { Task } from "./Task";
import { Defaults } from "./Defaults";

/**
 * Thread Pool
 *
 * A pool of (lazily or pre)-allocated threads from which to load
 * balance any number of multithreaded operations. The pool
 * automatically loadbalances tasks, greedily shuts down threads,
 * supports max-concurrency per thread, and allows for type-safe
 * multi-threaded operations.
 */
export class ThreadPool<
  Args extends Record<string, any>,
  Result,
> extends AbstractThreadPool<
  Args,
  Result,
  WorkerOptions,
  Worker,
  WebWorkerResult<Result>,
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
