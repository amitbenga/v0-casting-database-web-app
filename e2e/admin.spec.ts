import { test, expect } from "@playwright/test"

test.use({ storageState: "e2e/.auth/user.json" })

test.describe("Admin Page", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/admin")
        await page.waitForLoadState("networkidle")
    })

    test("should display admin page", async ({ page }) => {
        // Should show heading for admin/submission management
        const heading = page.getByRole("heading").first()
        await expect(heading).toBeVisible()
    })

    test("should show submissions table or empty state", async ({ page }) => {
        // Either we see a table of submissions or an empty state
        const hasTable = await page.locator("table, [data-testid='submissions-table']").isVisible().catch(() => false)
        const hasEmpty = await page.getByText(/אין בקשות|ריק/).isVisible().catch(() => false)

        // At least one should be visible
        expect(hasTable || hasEmpty).toBeTruthy()
    })

    test("should have clear rejected button if rejected items exist", async ({ page }) => {
        // Check for the "נקה הכל" button for rejected submissions
        const clearBtn = page.getByRole("button", { name: /נקה|מחק דחויות/ })
        // This is conditional — only shows when there are rejected submissions
        if (await clearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Just verify it's clickable
            await expect(clearBtn).toBeEnabled()
        }
    })
})
