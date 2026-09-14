import type { WorkerRequest } from "./types";

export abstract class AbstractWorker<
  Args,
  OptionsOrTransferables,
  O extends Record<string, any>,
> {
  constructor(_script: string | URL, _options: O) {}

  public abstract terminate(): unknown;

  public abstract postMessage(
    message: WorkerRequest<Args>,
    options?: OptionsOrTransferables,
  ): void;
}
