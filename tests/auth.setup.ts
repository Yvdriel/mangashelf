import { test as setup, expect, request } from "@playwright/test";
import {
  TEST_ADMIN,
  TEST_USER,
  STORAGE_STATE,
  REGULAR_STORAGE_STATE,
} from "./seed/credentials";

setup("authenticate via /setup (first-login flow)", async ({ page, baseURL }) => {
  const origin = baseURL ?? "http://localhost:3100";

  // Probe whether the running server still has users provisioned. global-setup
  // wipes .test-data/test.db on each run, but a long-lived dev server may
  // still hold an open file descriptor to the previous inode and report
  // "users exist" against that stale connection.
  const probe = await request.newContext({ baseURL });
  const status = await probe.get("/api/auth/setup-status");
  const { needsSetup } = (await status.json()) as { needsSetup: boolean };
  await probe.dispose();

  if (needsSetup) {
    await page.goto("/setup");
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.getByLabel("Display Name").fill(TEST_ADMIN.name);
    await page.getByLabel("Email").fill(TEST_ADMIN.email);
    await page.getByLabel("Password", { exact: true }).fill(TEST_ADMIN.password);
    await page.getByLabel("Confirm Password").fill(TEST_ADMIN.password);

    await page.getByRole("button", { name: "Create Admin Account" }).click();
    await page.waitForURL("/", { timeout: 15_000 });
    await expect(page).toHaveURL(/\/$/);

    await page.context().storageState({ path: STORAGE_STATE });
  } else {
    // Already provisioned — just sign in as admin and persist state.
    const adminContext = await request.newContext({
      baseURL,
      extraHTTPHeaders: { Origin: origin },
    });
    const res = await adminContext.post("/api/auth/sign-in/email", {
      data: { email: TEST_ADMIN.email, password: TEST_ADMIN.password },
    });
    expect(res.ok(), `admin sign-in failed: ${await res.text()}`).toBeTruthy();
    await adminContext.storageState({ path: STORAGE_STATE });
    await adminContext.dispose();
  }

  // Provision a regular user using the admin session. Idempotent: ignore
  // "user already exists" so re-runs against a stale dev server don't fail.
  const adminContext = await request.newContext({
    baseURL,
    storageState: STORAGE_STATE,
    extraHTTPHeaders: { Origin: origin },
  });
  const createRes = await adminContext.post("/api/auth/admin/create-user", {
    data: {
      name: TEST_USER.name,
      email: TEST_USER.email,
      password: TEST_USER.password,
      role: "user",
    },
  });
  if (!createRes.ok()) {
    const body = await createRes.text();
    if (!/already|exists|unique/i.test(body)) {
      throw new Error(`create-user failed: ${body}`);
    }
  }
  await adminContext.dispose();

  // Capture regular-user storage state.
  const userContext = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: origin },
  });
  const signInRes = await userContext.post("/api/auth/sign-in/email", {
    data: { email: TEST_USER.email, password: TEST_USER.password },
  });
  expect(
    signInRes.ok(),
    `regular sign-in failed: ${await signInRes.text()}`,
  ).toBeTruthy();
  await userContext.storageState({ path: REGULAR_STORAGE_STATE });
  await userContext.dispose();
});
