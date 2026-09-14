import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        test: {
          include: ["./src/web/**/*.spec.ts"],
          name: { label: "Web", color: "blue" },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
      {
        test: {
          include: ["./src/node/**/*.spec.ts"],
          name: { label: "Node", color: "green" },
          environment: "node",
        },
      },
    ],
  },
});
