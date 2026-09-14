export class SharedDefaults {
  public readonly maximumThreadCount: number = 4;
  public readonly lazySpawnThreads = true;
  public readonly threadIdleTimeout = 2000;
  public readonly maxConcurrency = Infinity;
  public readonly taskTimeoutThreshold = Infinity;
}

export const Defaults = new SharedDefaults();
