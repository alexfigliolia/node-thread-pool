import type {
  TaskArgs,
  WorkerResponse,
  WorkerTaskError,
  WorkerTaskResponse,
} from "../shared";

export type WebWorkerEvent<Args> = MessageEvent<TaskArgs<Args>>;

export type WebWorkerResponse<Result> = MessageEvent<
  WorkerResponse<Result, unknown>
>;

export type WebWorkerTaskResponse<Result> = MessageEvent<
  WorkerTaskResponse<Result>
>;

export type WebWorkerError<Error> = MessageEvent<WorkerTaskError<Error>>;
