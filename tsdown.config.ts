import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/web/index.ts", "src/node/index.ts"],
  dts: true,
  shims: true,
  clean: false,
  unbundle: true,
  exports: true,
  format: ["cjs", "esm"],
});
