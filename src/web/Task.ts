import { AbstractTask } from "../shared";

/**
 * Task
 *
 * A wrapper around a threaded task. With a reference to it,
 * you can await the result of it's operation or query its status
 */
export class Task<Args, Result> extends AbstractTask<Args, Result> {}
