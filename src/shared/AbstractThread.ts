import { AutoIncrementingID, EventEmitter } from "@figliolia/event-emitter";

import type { WorkerResponse, WorkerTaskResponse } from "./types";
import { TaskType, type EventStream, type IThread } from "./types";
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
  Args,
  Result,
  OptionsOrTransferables,
  WorkerType extends AbstractWorker<Args, OptionsOrTransferables, any>,
  IncomingMessage extends Record<string, any>,
  Task extends AbstractTask<
    Args,
    Result,
    OptionsOrTransferables,
    WorkerType,
    IncomingMessage
  >,
> {
  public isDead = false;
  public Worker: WorkerType;
  protected killPromise?: Promise<void>;
  private idleKillListener?: Promise<void>;
  public static readonly Defaults = Defaults;
  public readonly configuration: Required<IThread>;
  private readonly idleCallbacks: (() => void)[] = [];
  private readonly pendingTasks = new Map<string, Task>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly IDs = new AutoIncrementingID();
  protected readonly Emitter = new EventEmitter<EventStream<Result>>();
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
    options?: OptionsOrTransferables,
    taskTimeoutThreshold = this.configuration.taskTimeoutThreshold,
  ) {
    if (this.isDead) {
      this.respawn();
    }
    this.clearIdleTimer();
    if (this.totalOutstandingTasks >= this.configuration.maxConcurrency) {
      await this.waitOnMaxConcurrency();
    }
    const ID = this.IDs.get();
    const task = this.createTask({
      ID,
      args,
      taskTimeoutThreshold,
    });
    this.pendingTasks.set(ID, task);
    return task.run(this, options).finally(() => {
      this.pendingTasks.delete(ID);
      if (this.pendingTasks.size === 0) {
        this.deferShutDown();
        this.flushIdleCallbacks();
      }
    });
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
    return this.runForcedShutDownProtocol();
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

  public subscribeToTask(
    ID: string,
    callback: (response: WorkerTaskResponse<Result, unknown>) => void,
  ) {
    const subscriber = this.Emitter.on(ID, result => {
      if (result.type === TaskType.TASK) {
        callback(result);
      }
    });
    return () => {
      this.Emitter.off(ID, subscriber);
    };
  }

  protected abstract terminateWorker(): Promise<void>;

  protected abstract spawnWorker(): WorkerType;

  protected abstract deriveResponse(
    message: IncomingMessage,
  ): WorkerResponse<Result>;

  protected abstract createTask(
    ...args: ConstructorParameters<
      typeof AbstractTask<
        Args,
        Result,
        OptionsOrTransferables,
        WorkerType,
        IncomingMessage
      >
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

  protected respawn() {
    if (!this.isDead) {
      return;
    }
    this.isDead = false;
    this.killPromise = undefined;
    this.idleKillListener = undefined;
    this.Worker = this.spawnWorker();
  }

  protected runForcedShutDownProtocol(runOnDestroy = true) {
    this.clearIdleTimer();
    this.isDead = true;
    this.killPromise = this.terminateWorker().then(() => {
      if (runOnDestroy) {
        this.configuration?.onDestroy?.();
      }
      for (const [_, task] of this.pendingTasks) {
        task.reject("Thread killed manually");
      }
      this.pendingTasks.clear();
      this.flushIdleCallbacks();
    });
    return this.killPromise;
  }
}
