import type { WorkerOptions } from "node:worker_threads";

import type { IThreadPool } from "./types";
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
export class ThreadPool<Args extends Record<string, any>, Result> {
  public readonly taskTimeoutThreshold?: number;
  public readonly configuration: Required<IThreadPool>;
  private readonly POOL: (Thread<Args, Result> | undefined)[];
  constructor(
    config: IThreadPool,
    public readonly workerOptions?: WorkerOptions,
  ) {
    config.totalThreads ??= Defaults.totalThreads;
    config.maxConcurrency ??= Defaults.maxConcurrency;
    config.lazySpawnThreads ??= Defaults.lazySpawnThreads;
    config.threadIdleTimeout ??= Defaults.threadIdleTimeout;
    config.taskTimeoutThreshold ??= Defaults.taskTimeoutThreshold;
    this.configuration = config as Required<IThreadPool>;
    this.POOL = Array.from({ length: config.totalThreads }, (_, i) => {
      if (this.configuration.lazySpawnThreads) {
        return;
      }
      return this.createThread(i);
    });
  }

  /**
   * Enqueue Task
   *
   * Posts your arguments to the most idle thread in the pool.
   * Returns a promise containing the data from your worker's
   * corresponding postMessage() call
   */
  public async enqueueTask(args: Args) {
    const index = this.getidleThreadIndex();
    this.POOL[index] ??= this.createThread(index);
    const result = this.POOL[index].enqueueTask(args);
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
      this.POOL.map(thread => Promise.resolve(thread?.kill?.())),
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
      this.POOL.map(thread => Promise.resolve(thread?.killBackground?.())),
    );
    this.releaseThreads();
  }

  /**
   * Pending Tasks
   *
   * Returns a list of all currently running tasks in the pool
   */
  public get pendingTasks() {
    const tasks: Task<Args, Result>[] = [];
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
   * Returns the current thread pool. Undefined array indices represent
   * threads that not yet been allocated or have shutdown due to their
   * idle state exceeding the `threadIdleTimeout`
   */
  public get threads() {
    return this.POOL;
  }

  private getidleThreadIndex() {
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
    const { workerScript, threadIdleTimeout, taskTimeoutThreshold } =
      this.configuration;
    return new Thread<Args, Result>(
      {
        workerScript,
        threadIdleTimeout,
        taskTimeoutThreshold,
        onDestroy: () => {
          this.POOL[position] = undefined;
        },
      },
      this.workerOptions,
    );
  }

  private releaseThreads() {
    for (let i = 0; i < this.configuration.totalThreads; i++) {
      this.POOL[i] = undefined;
    }
  }
}
