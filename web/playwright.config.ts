import { defineConfig, devices } from "@playwright/test";

/** `next dev` uses 3000, so the production server these tests start has its own port. */
const PORT = 3200;
const BASE_URL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);

/** Builds the production app, then serves it. */
const START_SERVER = `npm run build && npm run start -- --port ${PORT}`;

export default defineConfig({
  testDir: "e2e",
  // A few tests share one server, and one worker keeps a failure easy to read.
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    headless: true,
    // A field that is not there fails the step in 10 seconds, not at the end of the test timeout.
    actionTimeout: 10_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: START_SERVER,
    url: BASE_URL,
    // Outside CI, a server already listening on PORT is reused as it is, with whatever build it
    // started from. Stop it after a manual run, or the next run tests that old build.
    reuseExistingServer: !isCI,
    // The build is part of the start-up. It took about 10 seconds on a laptop with no earlier
    // build; the rest of the time is for a slower machine.
    timeout: 300_000,
  },
});
