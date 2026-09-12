import type {
  IWorkerResolvedError,
  IWorkerResolvedResult,
  IWorkerResult,
  WorkerArgs,
} from "../shared";

export type WebWorkerEvent<T extends Record<string, any>> = MessageEvent<
  WorkerArgs<T>
>;

export type WebWorkerResult<Result> = WebWorkerEvent<
  IWorkerResult<Result, unknown>
>;

export type WebWorkerResolvedResult<Result> = WebWorkerEvent<
  IWorkerResolvedResult<Result>
>;

export type WebWorkerResolvedError<Error> = WebWorkerEvent<
  IWorkerResolvedError<Error>
>;
