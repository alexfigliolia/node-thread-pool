import type { ITask, TaskArgs, WorkerTaskResult } from "./types";
import { TaskType } from "./types";
import { AbstractOperation } from "./AbstractOperation";

/**
 * Task
 *
 * A wrapper around a threaded task. With a reference to it,
 * you can await the result of it's operation or query its status
 */
export abstract class AbstractTask<Args, Result> extends AbstractOperation<
  Result,
  Required<ITask<Args>>,
  TaskArgs<Args>
> {
  public override taskArgs(): TaskArgs<Args> {
    const { ID, args } = this.options;
    return { args, ID, type: TaskType.TASK };
  }

  protected override getResult(response: WorkerTaskResult<Result>) {
    return response.result;
  }
}
