import type { WorkerOptions } from "node:worker_threads";
import { Worker } from "node:worker_threads";

import type { IThread } from "./types";
import { Task } from "./Task";
import { Defaults } from "./Defaults";

/**
 * Thread
 *
 * A wrapper around the `node:worker_threads.Worker` supporting type-safe
 * operations, concurrency limits, and automatic shut down
 */
export class Thread<Args extends Record<string, any>, Result> {
  public isDead = false;
  public Worker: Worker;
  private killPromise?: Promise<void>;
  private idleKillListener?: Promise<void>;
  public readonly configuration: Required<IThread>;
  private readonly idleCallbacks: (() => void)[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly pendingTasks = new Map<string, Task<Args, Result>>();
  constructor(
    config: IThread,
    public readonly workerOptions?: WorkerOptions,
  ) {
    config.maxConcurrency ??= Defaults.maxConcurrency;
    config.threadIdleTimeout ??= Defaults.threadIdleTimeout;
    config.taskTimeoutThreshold ??= Defaults.taskTimeoutThreshold;
    this.configuration = config as Required<IThread>;
    this.Worker = new Worker(config.workerScript, this.workerOptions);
  }

  /**
   * Enqueue Task
   *
   * Post a task to the current thread. Resolves with the resulting
   * data and task ID
   */
  public async enqueueTask(
    args: Args,
    timeoutThreshold = this.configuration.taskTimeoutThreshold,
  ) {
    if (this.isDead) {
      this.respawn();
    }
    this.clearIdleTimer();
    if (this.totalOutstandingTasks >= this.configuration.maxConcurrency) {
      await this.waitOnMaxConcurrency();
    }
    const task = new Task<Args, Result>(args, timeoutThreshold);
    const work = task.run(this);
    this.pendingTasks.set(task.ID, task);
    return work.finally(() => {
      this.pendingTasks.delete(task.ID);
      if (this.pendingTasks.size === 0) {
        this.deferKill();
        this.flushIdleCallbacks();
      }
    });
  }

  /**
   * Kill
   *
   * Forces the thread to shut down without waiting on pending tasks.
   * Consider this your utility to perform hard aborts to recover
   * machine resources as soon as possible.
   *
   * A `Thread` instance can be brought back to life simply by enqueuing
   * another task
   */
  public kill() {
    if (this.killPromise) {
      return this.killPromise;
    }
    this.clearIdleTimer();
    this.killPromise = this.Worker.terminate().then(() => {
      this.configuration?.onDestroy?.();
      for (const [_, task] of this.pendingTasks) {
        task.reject("Thread killed manually");
      }
      this.pendingTasks.clear();
      this.flushIdleCallbacks();
      this.isDead = true;
    });
    return this.killPromise;
  }

  /**
   * Kill Background
   *
   * Shuts down your thread once it reaches idle.
   *
   * A `Thread` instance can be brought back to life simply by enqueuing
   * another task
   */
  public killBackground() {
    if (this.isIdle) {
      if (this.killPromise) {
        return this.killPromise;
      }
      return this.kill();
    }
    if (!this.idleKillListener) {
      const { resolve, promise } = Promise.withResolvers<void>();
      this.idleKillListener = promise.then(() => this.kill());
      this.idleCallbacks.push(resolve);
    }
    return this.idleKillListener;
  }

  /**
   * Is Idle
   *
   * Returns true if there are now outstanding tasks on the thread
   */
  public get isIdle() {
    return this.totalOutstandingTasks === 0;
  }

  /**
   * Total Outstanding Tasks
   *
   * Returns the number of currently running tasks on the thread
   */
  public get totalOutstandingTasks() {
    return this.pendingTasks.size;
  }

  /**
   * Outstanding Tasks
   *
   * Returns a map (of task IDs to Task references) of currently running tasks
   * on the thread
   */
  public get outstandingTasks() {
    return this.pendingTasks;
  }

  private deferKill() {
    this.clearIdleTimer();
    this.timer = setTimeout(() => {
      void this.kill();
    }, this.configuration.threadIdleTimeout);
  }

  private clearIdleTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private flushIdleCallbacks() {
    while (this.idleCallbacks.length) {
      this.idleCallbacks.pop()?.();
    }
  }

  private async waitOnMaxConcurrency() {
    while (true) {
      if (this.totalOutstandingTasks > this.configuration.maxConcurrency) {
        break;
      }
      await Promise.race(
        Array.from(
          this.outstandingTasks.values().map(v => v.resolvers.promise),
        ),
      );
    }
  }

  private respawn() {
    if (!this.isDead) {
      return;
    }
    this.isDead = false;
    this.killPromise = undefined;
    this.idleKillListener = undefined;
    this.Worker = new Worker(
      this.configuration.workerScript,
      this.workerOptions,
    );
  }
}
