export abstract class AbstractWorker<O extends Record<string, any>> {
  constructor(_script: string | URL, _options: O) {}

  public abstract terminate(): unknown;
}
