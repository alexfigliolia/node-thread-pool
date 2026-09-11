import { availableParallelism } from "node:os";

import type { IWorkerPool } from "./types";
import { Thread } from "./Thread";

export class WorkerPool<
  Args extends Record<string, any>,
  Result extends Record<string, any>,
> {
  public readonly taskTimeoutThreshold?: number;
  public readonly configuration: Required<IWorkerPool>;
  private readonly POOL: (Thread<Args, Result> | undefined)[];
  constructor(config: IWorkerPool) {
    config.lazySpawnThreads ??= true;
    config.threadIdleTimeout ??= 2000;
    config.maxConcurrency ??= Infinity;
    config.taskTimeoutThreshold ??= Infinity;
    config.totalThreads ??= Math.trunc(availableParallelism() * 0.5);
    this.configuration = config as Required<IWorkerPool>;
    this.POOL = Array.from({ length: config.totalThreads }, (_, i) => {
      if (config.lazySpawnThreads) {
        return;
      }
      return this.createThread(i);
    });
  }

  public async enqueue(args: Args) {
    if (this.currentLoad > this.configuration.maxConcurrency) {
      await this.waitOnMaxConcurrency();
    }
    const index = this.getIdolThreadIndex();
    this.POOL[index] ??= this.createThread(index);
    const result = this.POOL[index].enqueueTask(args);
    return result;
  }

  public shutDown() {
    return Promise.all(
      this.POOL.map(thread => Promise.resolve(thread?.kill?.())),
    );
  }

  public shutDownBackground() {
    return Promise.all(
      this.POOL.map(thread => Promise.resolve(thread?.killBackground?.())),
    );
  }

  private getIdolThreadIndex() {
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

  private get currentLoad() {
    let load = 0;
    for (const thread of this.POOL) {
      load += thread?.outstandingTasks?.size ?? 0;
    }
    return load;
  }

  private async waitOnMaxConcurrency() {
    while (true) {
      if (this.currentLoad < this.configuration.maxConcurrency) {
        break;
      }
      await Promise.race(
        this.POOL.flatMap(thread =>
          Array.from(thread?.outstandingTasks.values?.() ?? { length: 0 }),
        ),
      );
    }
  }

  private createThread(position: number) {
    const { workerScript, threadIdleTimeout, taskTimeoutThreshold } =
      this.configuration;
    return new Thread<Args, Result>({
      workerScript,
      threadIdleTimeout,
      taskTimeoutThreshold,
      onDestroy: () => {
        this.POOL[position] = undefined;
      },
    });
  }
}
