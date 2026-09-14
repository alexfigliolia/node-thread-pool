import type { IThreadPool, ThreadLatency } from "./types";
import { Defaults } from "./Defaults";
import type { AbstractWorker } from "./AbstractWorker";
import type { AbstractThread } from "./AbstractThread";
import type { AbstractTask } from "./AbstractTask";
import type { AbstractPing } from "./AbstractPing";

/**
 * Thread Pool
 *
 * A pool of (lazily or pre)-allocated threads from which to load
 * balance any number of multithreaded operations. The pool will
 * automatically loadbalance tasks, greedily shut down threads,
 * support max-concurrency per thread, and allow for type-safe
 * multi-threaded operations.
 */
export abstract class AbstractThreadPool<
  Args,
  Result,
  OptionsOrTransferables,
  WorkerOptions extends Record<string, any>,
  WorkerType extends AbstractWorker<
    Args,
    OptionsOrTransferables,
    WorkerOptions
  >,
  IncomingMessage extends Record<string, any>,
  Task extends AbstractTask<Args, Result>,
  Ping extends AbstractPing,
  Thread extends AbstractThread<
    Args,
    Result,
    OptionsOrTransferables,
    WorkerType,
    IncomingMessage,
    Task,
    Ping
  >,
> {
  public static readonly Defaults = Defaults;
  private readonly POOL: (Thread | null)[];
  public readonly taskTimeoutThreshold?: number;
  public readonly options: Required<IThreadPool>;
  constructor(
    options: IThreadPool,
    public readonly workerOptions?: WorkerOptions,
  ) {
    const defaults = (this.constructor as typeof AbstractThreadPool).Defaults;
    options.maximumThreadCount ??= defaults.maximumThreadCount;
    options.maxConcurrency ??= defaults.maxConcurrency;
    options.lazySpawnThreads ??= defaults.lazySpawnThreads;
    options.threadIdleTimeout ??= defaults.threadIdleTimeout;
    options.taskTimeoutThreshold ??= defaults.taskTimeoutThreshold;
    this.options = options as Required<IThreadPool>;
    this.POOL = Array.from(
      { length: this.options.maximumThreadCount },
      (_, i) => {
        if (this.options.lazySpawnThreads) {
          return null;
        }
        return this.createThread(i);
      },
    );
  }

  /**
   * Enqueue Task
   *
   * Posts your arguments to the most idle thread in the pool.
   * Returns a promise containing the data from your worker's
   * corresponding postMessage() call
   */
  public async enqueueTask(
    args: Args,
    options?: OptionsOrTransferables,
    taskTimeoutThreshold = this.options.taskTimeoutThreshold,
  ) {
    const index =
      this.getIdleThreadIndex() ??
      (await this.getThreadWithLowestLatency(
        taskTimeoutThreshold,
        result => result.index,
      ));
    this.POOL[index] ??= this.createThread(index);
    const result = this.POOL[index].enqueueTask(
      args,
      options,
      taskTimeoutThreshold,
    );
    return result;
  }
  /**
   * Ping
   *
   * Pings each thread in the thread pool returning the lowest latency
   * out of each thread. Returns the thread instance, index, and latency measure
   */
  public ping(taskTimeoutThreshold = this.options.taskTimeoutThreshold) {
    return this.getThreadWithLowestLatency(taskTimeoutThreshold, result => ({
      ...result,
      thread: this.POOL[result.index]!,
    }));
  }

  /**
   * Shut Down
   *
   * Forces the thread pool to shut down without all threads
   * waiting on pending tasks.
   *
   * Consider this your utility to perform a hard abort to recover
   * machine resources as soon as possible.
   *
   * After shutdown, your instance can be brought back to life simply
   * by enqueuing a task
   */
  public async shutDown() {
    await Promise.all(
      this.POOL.map(thread => Promise.resolve(thread?.shutDown?.())),
    );
    this.releaseThreads();
  }

  /**
   * Shut Down Background
   *
   * Shuts down all threads in the pool when the nearest idle state
   * is reached
   *
   * All tasks will complete prior to shut down
   *
   * After shutdown, your instance can be brought back to life simply
   * by enqueuing a task
   */
  public async shutDownBackground() {
    await Promise.all(
      this.POOL.map(thread => Promise.resolve(thread?.shutDownBackground?.())),
    );
    this.releaseThreads();
  }

  /**
   * Pending Tasks
   *
   * Returns a list of all currently running tasks in the pool
   */
  public get pendingTasks() {
    const tasks: (Task | Ping)[] = [];
    for (const thread of this.POOL) {
      tasks.push(...Array.from(thread?.outstandingTasks?.values?.() ?? []));
    }
    return tasks;
  }

  /**
   * Total Pending Tasks
   *
   * Returns the total number of pending tasks in the pool
   */
  public get totalPendingTasks() {
    return this.pendingTasks.length;
  }

  /**
   * Is Idle
   *
   * Returns true if all threads are idle
   */
  public get isIdle() {
    return this.totalPendingTasks === 0;
  }

  /**
   * Has An Idle Thread
   *
   * Returns true if one of more threads are idle
   */
  public get hasAnIdleThread() {
    for (const thread of this.POOL) {
      if (!thread || thread.isIdle) {
        return true;
      }
    }
    return false;
  }

  /**
   * Threads
   *
   * Returns a list of the current threads in the pool. If all threads
   * have idled and shut down, an empty array is returned
   */
  public get threads() {
    return this.POOL.filter(v => v !== null);
  }

  /**
   * Pool
   *
   * Returns the current thread pool. Null array indices represent
   * threads that not yet been allocated or have shutdown due to their
   * idle state exceeding the `threadIdleTimeout`
   */
  public get pool() {
    return this.POOL;
  }

  private getIdleThreadIndex() {
    let minIndex = 0;
    for (const thread of this.POOL) {
      const threadLoad = thread?.totalOutstandingTasks ?? 0;
      if (threadLoad === 0) {
        return minIndex;
      }
      minIndex++;
    }
    return undefined;
  }

  private async getThreadWithLowestLatency<T>(
    taskTimeoutThreshold = this.options.taskTimeoutThreshold,
    select: (result: ThreadLatency) => T,
  ) {
    const promises: Promise<ThreadLatency>[] = [];
    let index = -1;
    for (const thread of this.POOL) {
      ++index;
      if (!thread) {
        return select({ index, latency: 0 });
      }
      let current = index;
      promises.push(
        thread
          .ping(taskTimeoutThreshold)
          .then(latency => ({ latency, index: current })),
      );
    }
    return select(await this.race(...promises));
  }

  private createThread(position: number) {
    const {
      workerScript,
      maxConcurrency,
      threadIdleTimeout,
      taskTimeoutThreshold,
    } = this.options;
    return this.spawn(
      {
        workerScript,
        maxConcurrency,
        threadIdleTimeout,
        taskTimeoutThreshold,
        onDestroy: () => {
          this.POOL[position] = null;
        },
      },
      this.workerOptions,
    );
  }

  private releaseThreads() {
    for (let i = 0; i < this.POOL.length; i++) {
      this.POOL[i] = null;
    }
  }

  protected abstract spawn(
    ...args: ConstructorParameters<
      typeof AbstractThread<
        Args,
        Result,
        OptionsOrTransferables,
        WorkerType,
        IncomingMessage,
        Task,
        Ping
      >
    >
  ): Thread;

  private race<T>(...promises: Promise<T>[]) {
    const { resolve, reject, promise } = Promise.withResolvers<T>();
    let resolved = false;
    let rejections: any[] = [];
    for (const promise of promises) {
      void promise
        .then(result => {
          if (!resolved) {
            resolve(result);
          }
        })
        .catch(error => {
          rejections.push(error);
          if (rejections.length === promises.length) {
            reject(rejections);
          }
        });
    }
    return promise;
  }
}
