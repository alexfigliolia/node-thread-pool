import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  dts: true,
  shims: true,
  clean: false,
  unbundle: true,
  exports: true,
  format: ["cjs", "esm"],
});
