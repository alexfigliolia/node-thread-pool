import type { IThreadTask, PingArgs, WorkerPingResponse } from "./types";
import { TaskType } from "./types";
import { AbstractOperation } from "./AbstractOperation";

/**
 * Ping
 *
 * A health check task that measures latency between the main
 * thread and a worker thread
 */
export abstract class AbstractPing extends AbstractOperation<
  number,
  Required<IThreadTask>,
  PingArgs
> {
  public override taskArgs(): PingArgs {
    return { time: this.getTime(), ID: this.options.ID, type: TaskType.PING };
  }

  protected override getResult(response: WorkerPingResponse) {
    return response.time;
  }

  protected abstract getTime(): number;
}
