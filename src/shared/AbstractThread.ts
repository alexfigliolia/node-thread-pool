import type { IThread, WorkerArgs } from "./types";
import { Defaults } from "./Defaults";
import type { AbstractWorker } from "./AbstractWorker";
import type { AbstractTask } from "./AbstractTask";

/**
 * Thread
 *
 * A wrapper around the `node:worker_threads.Worker` supporting type-safe
 * operations, concurrency limits, and automatic shut down
 */
export abstract class AbstractThread<
  Args extends Record<string, any>,
  Result,
  WorkerType extends AbstractWorker<any>,
  IncomingMessage extends Record<string, any>,
  Task extends AbstractTask<Args, Result, WorkerType, IncomingMessage>,
> {
  public isDead = false;
  public Worker: WorkerType;
  private killPromise?: Promise<void>;
  private idleKillListener?: Promise<void>;
  public static readonly Defaults = Defaults;
  public readonly configuration: Required<IThread>;
  private readonly idleCallbacks: (() => void)[] = [];
  private readonly pendingTasks = new Map<string, Task>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    config: IThread,
    public readonly workerOptions?: WorkerOptions,
  ) {
    config.maxConcurrency ??= AbstractThread.Defaults.maxConcurrency;
    config.threadIdleTimeout ??= AbstractThread.Defaults.threadIdleTimeout;
    config.taskTimeoutThreshold ??=
      AbstractThread.Defaults.taskTimeoutThreshold;
    this.configuration = config as Required<IThread>;
    this.Worker = this.spawnWorker();
    this.deferShutDown();
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
    const task = this.createTask(args, timeoutThreshold);
    const work = task.run(this).finally(() => {
      this.pendingTasks.delete(task.ID);
      if (this.pendingTasks.size === 0) {
        this.deferShutDown();
        this.flushIdleCallbacks();
      }
    });
    this.pendingTasks.set(task.ID, task);
    return work;
  }

  /**
   * Shut Down
   *
   * Forces the thread to shut down without waiting on pending tasks.
   * Consider this your utility to perform hard aborts to recover
   * machine resources as soon as possible.
   *
   * A `Thread` instance can be brought back to life simply by enqueuing
   * another task
   */
  public shutDown() {
    if (this.killPromise) {
      return this.killPromise;
    }
    this.clearIdleTimer();
    this.killPromise = this.terminateWorker().then(() => {
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
   * Shut Down Background
   *
   * Shuts down your thread once it reaches idle.
   *
   * A `Thread` instance can be brought back to life simply by enqueuing
   * another task
   */
  public shutDownBackground() {
    if (this.isIdle) {
      if (this.killPromise) {
        return this.killPromise;
      }
      return this.shutDown();
    }
    if (!this.idleKillListener) {
      const { resolve, promise } = Promise.withResolvers<void>();
      this.idleKillListener = promise.then(() => this.shutDown());
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

  public abstract internallyPostMessage(args: WorkerArgs<Args>): void;

  public abstract internallySubscribe(
    onMessage: (message: IncomingMessage) => void,
    onError: (error: Error | ErrorEvent) => void,
  ): () => void;

  protected abstract terminateWorker(): Promise<void>;

  protected abstract spawnWorker(): WorkerType;

  protected abstract createTask(
    ...args: ConstructorParameters<
      typeof AbstractTask<Args, Result, WorkerType, IncomingMessage>
    >
  ): Task;

  private deferShutDown() {
    if (!isFinite(this.configuration.threadIdleTimeout)) {
      return;
    }
    this.clearIdleTimer();
    this.timer = setTimeout(() => {
      void this.shutDown();
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
    this.Worker = this.spawnWorker();
  }
}
