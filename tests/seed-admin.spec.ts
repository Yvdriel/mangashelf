import { test } from "@playwright/test";

test("seed: admin at /", async ({ page }) => {
  await page.goto("/");
});
