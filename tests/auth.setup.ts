import { test as setup, expect } from "@playwright/test";
import { TEST_ADMIN, STORAGE_STATE } from "./seed/credentials";

setup("authenticate via /setup (first-login flow)", async ({ page }) => {
  await page.goto("/setup");
  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.getByLabel("Display Name").fill(TEST_ADMIN.name);
  await page.getByLabel("Email").fill(TEST_ADMIN.email);
  await page.getByLabel("Password", { exact: true }).fill(TEST_ADMIN.password);
  await page.getByLabel("Confirm Password").fill(TEST_ADMIN.password);

  await page
    .getByRole("button", { name: "Create Admin Account" })
    .click();

  await page.waitForURL("/", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/$/);

  await page.context().storageState({ path: STORAGE_STATE });
});
