import { defineConfig } from "@playwright/test";
const baseURL = `http://127.0.0.1:4173${process.env.PAGES_BASE || "/puzzles/"}`;
export default defineConfig({
  testDir: "tests/browser",
  timeout: 45000,
  use: {
    baseURL,
    headless: true,
    launchOptions: process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {},
  },
  workers: 2,
  webServer: {
    command: "npm run preview -- --port 4173",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
