import { Worker } from "node:worker_threads";

import type { IThread, WorkerArgs } from "./types";
import { Task } from "./Task";

export class Thread<
  Args extends Record<string, any>,
  Result extends Record<string, any>,
> {
  private isShuttingDown = false;
  private readonly Worker: Worker;
  private idleKillListener?: Promise<void>;
  private readonly idleCallbacks: (() => void)[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingTasks = new Map<string, Promise<WorkerArgs<Result>>>();
  constructor(public readonly config: IThread) {
    this.Worker = new Worker(config.workerScript);
  }

  public enqueueTask(
    args: Args,
    timeoutThreshold = this.config.taskTimeoutThreshold,
  ) {
    this.clearIdleTimer();
    const task = new Task<Args, Result>(args, timeoutThreshold);
    const work = task.run(this.Worker);
    this.pendingTasks.set(task.ID, work);
    return work.finally(() => {
      this.pendingTasks.delete(task.ID);
      if (this.pendingTasks.size === 0) {
        this.deferKill();
      }
    });
  }

  public kill() {
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;
    this.clearIdleTimer();
    return this.Worker.terminate().then(() => this.config?.onDestroy?.());
  }

  public killBackground() {
    if (this.isIdol) {
      if (this.isShuttingDown) {
        return Promise.resolve();
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

  public get isIdol() {
    return this.pendingTasks.size === 0;
  }

  public get outstandingTasks() {
    return this.pendingTasks;
  }

  private deferKill() {
    this.clearIdleTimer();
    this.timer = setTimeout(() => {
      void this.kill();
    }, this.config.threadIdleTimeout);
  }

  private clearIdleTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
