import { test, expect } from "@playwright/test";
import { TEST_ADMIN } from "./seed/credentials";

test.describe("auth flows (unauthenticated)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/setup redirects to /login once a user exists", async ({ page }) => {
    await page.goto("/setup");
    await page.waitForURL(/\/login$/);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("/login happy path with seeded admin", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").waitFor();
    await page.getByLabel("Email").fill(TEST_ADMIN.email);
    await page.getByLabel("Password").fill(TEST_ADMIN.password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page.waitForURL("/", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/$/);
  });

  test("/login rejects wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").waitFor();
    await page.getByLabel("Email").fill(TEST_ADMIN.email);
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    const errorBox = page.locator("div.text-red-400");
    await expect(errorBox).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
