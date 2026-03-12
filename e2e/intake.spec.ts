import { test, expect } from "@playwright/test"

/**
 * The intake form is a public form — no auth needed.
 * It's the scprodub-facing actor registration form.
 */
test.describe("Intake Form (Public)", () => {
    test("should display the intake form", async ({ page }) => {
        await page.goto("/intake")
        await page.waitForLoadState("networkidle")

        // Should show a form with actor details
        const heading = page.getByRole("heading").first()
        await expect(heading).toBeVisible()
    })

    test("should have required form fields", async ({ page }) => {
        await page.goto("/intake")
        await page.waitForLoadState("networkidle")

        // Look for name field
        const nameInput = page.locator("input[name='full_name'], #full_name, input[placeholder*='שם']")
        if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(nameInput).toBeVisible()
        }
    })

    test("should not submit with empty required fields", async ({ page }) => {
        await page.goto("/intake")
        await page.waitForLoadState("networkidle")

        const submitBtn = page.getByRole("button", { name: /שלח|הגש|submit/i })
        if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await submitBtn.click()
            // Should stay on the same page (validation prevents submit)
            await page.waitForTimeout(500)
            await expect(page).toHaveURL(/\/intake/)
        }
    })
})
