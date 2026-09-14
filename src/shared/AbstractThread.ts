import { AutoIncrementingID, EventEmitter } from "@figliolia/event-emitter";

import type { WorkerResponse } from "./types";
import { TaskType, type EventStream, type IThread } from "./types";
import { Defaults } from "./Defaults";
import { BackgroundTask } from "./BackgroundTask";
import type { AbstractWorker } from "./AbstractWorker";
import type { AbstractTask } from "./AbstractTask";
import type { AbstractPing } from "./AbstractPing";

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
  Task extends AbstractTask<Args, Result>,
  Ping extends AbstractPing,
> {
  public isDead = false;
  protected Worker: WorkerType;
  protected killPromise?: Promise<void>;
  private idleKillListener?: Promise<void>;
  public static readonly Defaults = Defaults;
  public readonly options: Required<IThread>;
  private readonly IDs = new AutoIncrementingID();
  private readonly shutDownSchedule: BackgroundTask;
  private readonly idleCallbacks: (() => void)[] = [];
  private readonly pendingTasks = new Map<string, Task | Ping>();
  protected readonly Emitter = new EventEmitter<EventStream<Result>>();
  constructor(
    config: IThread,
    public readonly workerOptions?: WorkerOptions,
  ) {
    config.maxConcurrency ??= AbstractThread.Defaults.maxConcurrency;
    config.threadIdleTimeout ??= AbstractThread.Defaults.threadIdleTimeout;
    config.taskTimeoutThreshold ??=
      AbstractThread.Defaults.taskTimeoutThreshold;
    this.options = config as Required<IThread>;
    this.Worker = this.spawnWorker();
    this.shutDownSchedule = new BackgroundTask(
      this.options.threadIdleTimeout,
      () => {
        void this.shutDown();
      },
    );
    this.shutDownSchedule.start();
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
    taskTimeoutThreshold = this.options.taskTimeoutThreshold,
  ) {
    const task = await this.spawn(ID =>
      this.createTask({
        ID,
        args,
        taskTimeoutThreshold,
      }),
    );
    const subscriber = this.subscribeToTask(task);
    this.Worker.postMessage(task.taskArgs(), options);
    return task.run().finally(() => {
      this.onComplete(task, subscriber);
    });
  }

  /**
   * Ping
   *
   * Measures latency between the main thread and the current worker thread
   */
  public async ping(taskTimeoutThreshold = this.options.taskTimeoutThreshold) {
    const ping = await this.spawn(ID =>
      this.createPing({
        ID,
        taskTimeoutThreshold,
      }),
    );
    const subscriber = this.subscribeToPing(ping);
    this.Worker.postMessage(ping.taskArgs());
    return ping.run().finally(() => {
      this.onComplete(ping, subscriber);
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
    if (this.killPromise) {
      return this.killPromise;
    }
    if (this.isIdle) {
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

  protected abstract terminateWorker(): Promise<void>;

  protected abstract spawnWorker(): WorkerType;

  protected abstract deriveResponse(
    message: IncomingMessage,
  ): WorkerResponse<Result>;

  protected abstract createTask(
    ...args: ConstructorParameters<typeof AbstractTask<Args, Result>>
  ): Task;

  protected abstract createPing(
    ...args: ConstructorParameters<typeof AbstractPing>
  ): Ping;

  private flushIdleCallbacks() {
    while (this.idleCallbacks.length) {
      this.idleCallbacks.pop()?.();
    }
  }

  private async waitOnMaxConcurrency() {
    while (true) {
      if (this.totalOutstandingTasks > this.options.maxConcurrency) {
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

  protected runForcedShutDownProtocol(runDestroy = true) {
    this.shutDownSchedule.stop();
    this.isDead = true;
    this.killPromise = this.terminateWorker().then(() => {
      if (runDestroy) {
        this.options?.onDestroy?.();
      }
      for (const [_, task] of this.pendingTasks) {
        task.reject("Thread killed manually");
      }
      this.pendingTasks.clear();
      this.flushIdleCallbacks();
    });
    return this.killPromise;
  }

  private onStream(
    ID: string,
    callback: (response: WorkerResponse<Result, unknown>) => void,
  ) {
    const subscriber = this.Emitter.on(ID, callback);
    return () => {
      this.Emitter.off(ID, subscriber);
    };
  }

  private subscribeToTask(task: Task) {
    return this.onStream(task.options.ID, result => {
      if (result.type === TaskType.TASK) {
        return task.onResponse(result);
      }
      task.reject(new Error("Invalid Response", { cause: result }));
    });
  }

  private subscribeToPing(ping: Ping) {
    return this.onStream(ping.options.ID, result => {
      if (result.type === TaskType.PING) {
        return ping.onResponse(result);
      }
      ping.reject(new Error("Invalid Response", { cause: result }));
    });
  }

  private async spawn<T extends Task | Ping>(creator: (ID: string) => T) {
    if (this.isDead) {
      this.respawn();
    }
    const ID = this.IDs.get();
    const task = creator(ID);
    if (this.totalOutstandingTasks >= this.options.maxConcurrency) {
      this.shutDownSchedule.stop();
      await this.waitOnMaxConcurrency();
    }
    this.pendingTasks.set(ID, task);
    this.shutDownSchedule.start();
    return task;
  }

  private onComplete(task: Task | Ping, subscriber: () => void) {
    subscriber();
    this.pendingTasks.delete(task.options.ID);
    if (this.pendingTasks.size === 0) {
      this.shutDownSchedule.start();
      this.flushIdleCallbacks();
    }
  }
}
