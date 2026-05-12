import { defineConfig, devices } from "@playwright/test";
import path from "path";

const TEST_DATA_DIR = path.resolve(__dirname, ".test-data");
const TEST_DB_PATH = path.join(TEST_DATA_DIR, "test.db");
const TEST_MANGA_DIR = path.join(TEST_DATA_DIR, "manga");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html"], ["list"]],
  globalSetup: "./tests/global-setup.ts",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      E2E: "1",
      DATABASE_URL: TEST_DB_PATH,
      MANGA_DIR: TEST_MANGA_DIR,
      AUTO_DOWNLOAD: "false",
      // Stub external services so any accidental call fails fast, not silently.
      JACKETT_URL: "http://127.0.0.1:1",
      JACKETT_API_KEY: "test",
      DELUGE_URL: "http://127.0.0.1:1",
      DELUGE_PASSWORD: "test",
    },
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
