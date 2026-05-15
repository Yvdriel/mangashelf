import { test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("seed: logged-out at /", async ({ page }) => {
  await page.goto("/");
});
