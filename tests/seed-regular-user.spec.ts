import { test } from "@playwright/test";

test.use({ storageState: "playwright/.auth/regular.json" });

test("seed: regular user at /", async ({ page }) => {
  await page.goto("/");
});
