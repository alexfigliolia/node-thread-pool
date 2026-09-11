import { availableParallelism } from "node:os";

export class Defaults {
  public static readonly lazySpawnThreads = true;
  public static readonly threadIdleTimeout = 2000;
  public static readonly maxConcurrency = Infinity;
  public static readonly taskTimeoutThreshold = Infinity;
  public static readonly totalThreads = Math.trunc(
    availableParallelism() * 0.5,
  );
}
