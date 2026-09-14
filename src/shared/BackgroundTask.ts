export class BackgroundTask {
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    public readonly threshold: number,
    public readonly callback: () => void,
  ) {}
  public start() {
    this.stop();
    if (isFinite(this.threshold)) {
      this.timer = setTimeout(() => {
        this.callback();
      }, this.threshold);
    }
  }

  public stop() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
