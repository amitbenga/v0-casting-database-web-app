import { test as setup, expect } from "@playwright/test"
import path from "path"

const authFile = path.join(__dirname, ".auth", "user.json")

/**
 * Authenticate once, save state, and reuse in all tests.
 * Requires PLAYWRIGHT_USER_EMAIL and PLAYWRIGHT_USER_PASSWORD env vars.
 * Falls back to test@scprodub.co.il / test1234 for local dev.
 */
setup("authenticate", async ({ page }) => {
    const email = process.env.PLAYWRIGHT_USER_EMAIL ?? "test@scprodub.co.il"
    const password = process.env.PLAYWRIGHT_USER_PASSWORD ?? "test1234"

    await page.goto("/login")
    await expect(page.getByRole("heading", { name: /התחברות למערכת/ })).toBeVisible()

    await page.fill("#email", email)
    await page.fill("#password", password)
    await page.getByRole("button", { name: /התחבר/ }).click()

    // Wait for redirect to the main page (actors list)
    await page.waitForURL("/", { timeout: 15_000 })
    await expect(page).toHaveURL("/")

    // Save the authenticated state
    await page.context().storageState({ path: authFile })
})
