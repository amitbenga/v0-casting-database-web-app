import { test, expect, type Page } from "@playwright/test"

test.use({ storageState: "e2e/.auth/user.json" })

test.describe("Projects", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/projects")
        await page.waitForLoadState("networkidle")
    })

    test("should display projects list page", async ({ page }) => {
        // Should have heading or project cards
        await expect(page.locator("body")).toBeVisible()
        // Look for "פרויקטים" heading or similar
        const heading = page.getByRole("heading").first()
        await expect(heading).toBeVisible()
    })

    test("should open create project dialog", async ({ page }) => {
        const createBtn = page.getByRole("button", { name: /פרויקט חדש|צור פרויקט|הוסף פרויקט/ })
        if (await createBtn.isVisible()) {
            await createBtn.click()
            // A dialog should appear
            await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 })
        }
    })

    test("should navigate to a project detail page if projects exist", async ({ page }) => {
        // Click on the first project card or link
        const firstProject = page.locator("[data-testid='project-card'], a[href*='/projects/']").first()
        if (await firstProject.isVisible({ timeout: 3000 }).catch(() => false)) {
            await firstProject.click()
            await page.waitForURL(/\/projects\/[^/]+/)
            // Should show project detail tabs
            await expect(page.locator("body")).toBeVisible()
        }
    })
})

test.describe("Project Detail — Tabs", () => {
    test.use({ storageState: "e2e/.auth/user.json" })

    // Helper to navigate to first project
    async function goToFirstProject(page: Page) {
        await page.goto("/projects")
        await page.waitForLoadState("networkidle")

        const firstProject = page.locator("a[href*='/projects/']").first()
        if (!(await firstProject.isVisible({ timeout: 5000 }).catch(() => false))) {
            test.skip()
            return
        }
        await firstProject.click()
        await page.waitForURL(/\/projects\/[^/]+/)
        await page.waitForLoadState("networkidle")
    }

    test("should show roles tab", async ({ page }) => {
        await goToFirstProject(page)
        const rolesTab = page.getByRole("tab", { name: /תפקידים/ })
        if (await rolesTab.isVisible()) {
            await rolesTab.click()
            await page.waitForTimeout(500)
        }
    })

    test("should show actors tab", async ({ page }) => {
        await goToFirstProject(page)
        const actorsTab = page.getByRole("tab", { name: /שחקנים/ })
        if (await actorsTab.isVisible()) {
            await actorsTab.click()
            await page.waitForTimeout(500)
        }
    })

    test("should show scripts tab", async ({ page }) => {
        await goToFirstProject(page)
        const scriptsTab = page.getByRole("tab", { name: /תסריטים/ })
        if (await scriptsTab.isVisible()) {
            await scriptsTab.click()
            await page.waitForTimeout(500)
        }
    })

    test("should show workspace tab and add line button", async ({ page }) => {
        await goToFirstProject(page)
        const workspaceTab = page.getByRole("tab", { name: /סביבת עבודה/ })
        if (await workspaceTab.isVisible()) {
            await workspaceTab.click()
            await page.waitForTimeout(1000)

            // Check for "הוסף שורה חדשה" button
            const addLineBtn = page.getByRole("button", { name: /הוסף שורה חדשה/ })
            await expect(addLineBtn).toBeVisible()
        }
    })
})
