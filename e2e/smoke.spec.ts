import { test, expect } from "@playwright/test"

/**
 * Smoke tests: fast, non-destructive checks that all critical pages load.
 * These run without authentication.
 */
test.describe("Smoke Tests — Pages Load", () => {
    const pages = [
        { name: "Login", path: "/login" },
        { name: "Intake", path: "/intake" },
    ]

    for (const p of pages) {
        test(`${p.name} page loads (${p.path})`, async ({ page }) => {
            const response = await page.goto(p.path)
            expect(response?.status()).toBeLessThan(500)
            await expect(page.locator("body")).toBeVisible()
        })
    }
})

test.describe("Smoke Tests — Authenticated Pages", () => {
    test.use({ storageState: "e2e/.auth/user.json" })

    const authedPages = [
        { name: "Actors (Home)", path: "/" },
        { name: "Projects", path: "/projects" },
        { name: "Admin", path: "/admin" },
        { name: "Folders", path: "/folders" },
    ]

    for (const p of authedPages) {
        test(`${p.name} page loads (${p.path})`, async ({ page }) => {
            const response = await page.goto(p.path)
            expect(response?.status()).toBeLessThan(500)
            await page.waitForLoadState("networkidle")
            await expect(page.locator("body")).toBeVisible()
        })
    }
})
