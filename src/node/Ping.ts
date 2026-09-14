import { performance } from "node:perf_hooks";

import { AbstractPing } from "../shared";

/**
 * Ping
 *
 * A health check task that measures latency between the main
 * thread and a worker thread
 */
export class Ping extends AbstractPing {
  protected override getTime() {
    return performance.now();
  }
}
