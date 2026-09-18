import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e-auth",
  outputDir: "test-results-auth",
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:8793",
    viewport: { width: 360, height: 800 },
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        "/home/sravan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node --experimental-strip-types scripts/auth-test-server.ts",
    url: "http://127.0.0.1:8793/api/health",
    reuseExistingServer: false,
  },
});
