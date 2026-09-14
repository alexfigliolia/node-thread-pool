import { availableParallelism } from "node:os";

import { SharedDefaults } from "../shared";

class NodeDefaults extends SharedDefaults {
  public override readonly maximumThreadCount = Math.trunc(
    availableParallelism() * 0.5,
  );
}

export const Defaults = new NodeDefaults();
