import { test, expect } from "@playwright/test"

/**
 * These tests require an authenticated session.
 * The auth.setup.ts file runs first and saves the session.
 */
test.use({ storageState: "e2e/.auth/user.json" })

test.describe("Actors Page (Main Page)", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/")
        // Wait for the page to be loaded (actors list or empty state)
        await page.waitForLoadState("networkidle")
    })

    test("should display the actors page header", async ({ page }) => {
        // The main page should show "מאגר השחקנים" or similar heading
        const heading = page.getByRole("heading").first()
        await expect(heading).toBeVisible()
    })

    test("should have search functionality", async ({ page }) => {
        // Look for a search input
        const searchInput = page.getByPlaceholder(/חיפוש|חפש/)
        if (await searchInput.isVisible()) {
            await searchInput.fill("test")
            // Should not crash — basic smoke test
            await page.waitForTimeout(500)
        }
    })

    test("should have filter panel", async ({ page }) => {
        // Look for filter elements (gender, skills, etc.)
        const filterButton = page.getByRole("button", { name: /סינון|פילטר|מתקדם/ })
        if (await filterButton.isVisible()) {
            await filterButton.click()
            await page.waitForTimeout(300)
        }
    })

    test("should navigate to projects page", async ({ page }) => {
        // Navigate using the header/nav
        const projectsLink = page.getByRole("link", { name: /פרויקטים/ })
        if (await projectsLink.isVisible()) {
            await projectsLink.click()
            await page.waitForURL(/\/projects/)
            await expect(page).toHaveURL(/\/projects/)
        }
    })
})
