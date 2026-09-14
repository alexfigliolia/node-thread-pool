import type { IThreadPool } from "./types";
import { Defaults } from "./Defaults";
import type { AbstractWorker } from "./AbstractWorker";
import type { AbstractThread } from "./AbstractThread";
import type { AbstractTask } from "./AbstractTask";

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
  Task extends AbstractTask<
    Args,
    Result,
    OptionsOrTransferables,
    WorkerType,
    IncomingMessage
  >,
  Thread extends AbstractThread<
    Args,
    Result,
    OptionsOrTransferables,
    WorkerType,
    IncomingMessage,
    Task
  >,
> {
  public static readonly Defaults = Defaults;
  private readonly POOL: (Thread | null)[];
  public readonly taskTimeoutThreshold?: number;
  public readonly configuration: Required<IThreadPool>;
  constructor(
    config: IThreadPool,
    public readonly workerOptions?: WorkerOptions,
  ) {
    const defaults = (this.constructor as typeof AbstractThreadPool).Defaults;
    config.totalThreads ??= defaults.totalThreads;
    config.maxConcurrency ??= defaults.maxConcurrency;
    config.lazySpawnThreads ??= defaults.lazySpawnThreads;
    config.threadIdleTimeout ??= defaults.threadIdleTimeout;
    config.taskTimeoutThreshold ??= defaults.taskTimeoutThreshold;
    this.configuration = config as Required<IThreadPool>;
    this.POOL = Array.from(
      { length: this.configuration.totalThreads },
      (_, i) => {
        if (this.configuration.lazySpawnThreads) {
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
    taskTimeoutThreshold = this.configuration.taskTimeoutThreshold,
  ) {
    const index = this.getIdleThreadIndex();
    this.POOL[index] ??= this.createThread(index);
    const result = this.POOL[index].enqueueTask(
      args,
      options,
      taskTimeoutThreshold,
    );
    return result;
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
      this.POOL.map(thread => Promise.resolve(thread?.shutDown?.())),
    );
    this.releaseThreads();
  }

  /**
   * Pending Tasks
   *
   * Returns a list of all currently running tasks in the pool
   */
  public get pendingTasks() {
    const tasks: Task[] = [];
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
    let minIndex = this.configuration.totalThreads - 1;
    let minLoad = Infinity;
    let pointer = -1;
    for (const thread of this.POOL) {
      ++pointer;
      const threadLoad = thread?.outstandingTasks?.size ?? 0;
      if (threadLoad === 0) {
        return pointer;
      }
      if (threadLoad < minLoad) {
        minLoad = threadLoad;
        minIndex = pointer;
      }
    }
    return minIndex;
  }

  private createThread(position: number) {
    const {
      workerScript,
      maxConcurrency,
      threadIdleTimeout,
      taskTimeoutThreshold,
    } = this.configuration;
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
    for (let i = 0; i < this.configuration.totalThreads; i++) {
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
        Task
      >
    >
  ): Thread;
}
