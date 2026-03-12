import { test, expect } from "@playwright/test"

test.describe("Login Page", () => {
    test("should show login form", async ({ page }) => {
        await page.goto("/login")
        await expect(page.getByRole("heading", { name: /התחברות למערכת/ })).toBeVisible()
        await expect(page.locator("#email")).toBeVisible()
        await expect(page.locator("#password")).toBeVisible()
        await expect(page.getByRole("button", { name: /התחבר/ })).toBeVisible()
    })

    test("should show error with invalid credentials", async ({ page }) => {
        await page.goto("/login")
        await page.fill("#email", "fake@fake.com")
        await page.fill("#password", "wrongpassword")
        await page.getByRole("button", { name: /התחבר/ }).click()

        // Should show error message
        await expect(page.getByText(/שגיאה בהתחברות/)).toBeVisible({ timeout: 10_000 })
    })
})
