import type { ITask, TaskArgs, WorkerTaskResponse } from "./types";
import { TaskStatus, TaskType } from "./types";
import { AbstractWorkerResolver } from "./AbstractWorkerResolver";
import type { AbstractWorker } from "./AbstractWorker";
import type { AbstractThread } from "./AbstractThread";

/**
 * Task
 *
 * A wrapper around a threaded task. With a reference to it,
 * you can await the result of it's operation or query its status
 */
export abstract class AbstractTask<
  Args,
  Result,
  OptionsOrTransferables,
  WorkerType extends AbstractWorker<Args, OptionsOrTransferables, any>,
  IncomingMessage extends Record<string, any>,
> {
  public status = TaskStatus.PENDING;
  public readonly resolvers: PromiseWithResolvers<Result>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(public readonly options: ITask<Args>) {
    this.resolvers = Promise.withResolvers();
  }

  public run(
    thread: AbstractThread<
      Args,
      Result,
      OptionsOrTransferables,
      WorkerType,
      IncomingMessage,
      typeof this
    >,
    options?: OptionsOrTransferables,
  ) {
    const { ID, args } = this.options;
    const workerArgs = this.toWorkerArgs(args);
    const subscriber = thread.subscribeToTask(ID, this.onMessage);
    this.configureTimeout();
    thread.Worker.postMessage(workerArgs, options);
    return this.resolvers.promise.finally(() => {
      subscriber();
      this.shutDownTimer();
    });
  }

  public reject<E = unknown>(error: E) {
    this.resolvers.reject(
      AbstractWorkerResolver.error(this.options.ID, error).error,
    );
  }

  private configureTimeout() {
    const { taskTimeoutThreshold } = this.options;
    if (
      typeof taskTimeoutThreshold === "number" &&
      isFinite(taskTimeoutThreshold)
    ) {
      this.timer = setTimeout(() => {
        this.reject("Task timed out");
      }, taskTimeoutThreshold);
    }
  }

  private shutDownTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private toWorkerArgs<T>(args: T): TaskArgs<T> {
    return { args, ID: this.options.ID, type: TaskType.TASK };
  }

  private readonly onMessage = (message: WorkerTaskResponse<Result>) => {
    if ("error" in message) {
      this.status = TaskStatus.FAILED;
      this.resolvers.reject(message.error);
    } else {
      this.status = TaskStatus.SUCCEEDED;
      this.resolvers.resolve(message.result);
    }
  };
}
