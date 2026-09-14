import { SharedDefaults } from "../shared";

class WebDefaults extends SharedDefaults {
  public override readonly maximumThreadCount = Math.trunc(
    navigator.hardwareConcurrency * 0.5,
  );
}

export const Defaults = new WebDefaults();
