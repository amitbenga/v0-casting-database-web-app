import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright E2E config for the Casting Database Web App.
 *
 * Run all tests:       npx playwright test
 * Run smoke tests:     npx playwright test smoke
 * Run specific file:   npx playwright test login
 * Interactive UI mode: npx playwright test --ui
 * View last report:    npx playwright show-report
 */
export default defineConfig({
    testDir: "./e2e",
    outputDir: "./e2e/test-results",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [["html", { open: "never" }]],
    timeout: 30_000,

    use: {
        baseURL: "http://localhost:3000",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        locale: "he-IL",
        timezoneId: "Asia/Jerusalem",
    },

    projects: [
        /* Auth setup — runs first, saves browser state */
        {
            name: "setup",
            testMatch: /auth\.setup\.ts/,
        },
        /* Main tests — depend on the auth setup */
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                storageState: "e2e/.auth/user.json",
            },
            dependencies: ["setup"],
            testIgnore: /auth\.setup\.ts/,
        },
    ],

    /* Start the Next.js dev server before running tests */
    webServer: {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
    },
})
