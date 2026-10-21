import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/hydra", "web"],
  },
});
