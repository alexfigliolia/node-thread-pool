import type { IThreadTask, ThreadTask, WorkerResponse } from "./types";
import { TaskStatus } from "./types";
import { BackgroundTask } from "./BackgroundTask";
import { AbstractWorkerResolver } from "./AbstractWorkerResolver";

export abstract class AbstractOperation<
  Result,
  Options extends Required<IThreadTask>,
  TaskRequest extends ThreadTask,
> {
  public status = TaskStatus.PENDING;
  private readonly timeoutScheduler: BackgroundTask;
  public readonly resolvers = Promise.withResolvers<Result>();
  constructor(public readonly options: Options) {
    this.timeoutScheduler = new BackgroundTask(
      options.taskTimeoutThreshold,
      () => {
        this.reject("Task timed out");
      },
    );
  }

  public run() {
    this.timeoutScheduler.start();
    return this.resolvers.promise.finally(() => {
      this.timeoutScheduler.stop();
    });
  }

  public reject<E = unknown>(error: E) {
    this.resolvers.reject(
      AbstractWorkerResolver.error(this.options.ID, error).error,
    );
  }

  public onResponse(message: WorkerResponse<Result>) {
    if ("error" in message) {
      this.status = TaskStatus.FAILED;
      this.resolvers.reject(message.error);
    } else {
      this.status = TaskStatus.SUCCEEDED;
      this.resolvers.resolve(this.getResult(message));
    }
  }

  public abstract taskArgs(): TaskRequest;

  protected abstract getResult(response: WorkerResponse<Result>): Result;
}
