import fs from "fs";
import path from "path";
import { test as setup, expect, request } from "@playwright/test";
import {
  TEST_ADMIN,
  TEST_USER,
  STORAGE_STATE,
  REGULAR_STORAGE_STATE,
} from "./seed/credentials";

setup("authenticate via /setup (first-login flow)", async ({ page, baseURL }) => {
  // Cold next-dev boot has to compile /setup, /login, /, the admin API,
  // the manager API, and the auth endpoints during this test. 30s is not
  // enough on a clean .test-data directory.
  setup.setTimeout(180_000);

  // Ensure the manga fixture is in .test-data/manga. tests/global-setup.ts
  // already copies it, but the MCP playwright-test planner runs Playwright
  // through its own lifecycle that does NOT honor `globalSetup`. Doing the
  // copy here too means the fixture is guaranteed whenever the `setup`
  // project runs (which every dependent project — chromium, planner, spec
  // runs — pulls in via `dependencies: ["setup"]`). Idempotent: cpSync
  // overwrites with the same bytes when the dir is already populated.
  const root = path.resolve(__dirname, "..");
  const fixtureMangaDir = path.join(root, "tests", "fixtures", "manga");
  const testMangaDir = path.join(root, ".test-data", "manga");
  fs.mkdirSync(testMangaDir, { recursive: true });
  if (fs.existsSync(fixtureMangaDir)) {
    fs.cpSync(fixtureMangaDir, testMangaDir, {
      recursive: true,
      filter: (src) => path.basename(src) !== ".gitkeep",
    });
  }

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

  // Sync the library from the fixture directory copied by global-setup so
  // reader / OCR / progress flows have data on every run. Admin-gated.
  const scanRes = await adminContext.post("/api/library/scan");
  expect(
    scanRes.ok(),
    `library scan failed: ${await scanRes.text()}`,
  ).toBeTruthy();

  // Register the fixture in the manager domain so /api/covers/<anilistId>
  // resolves (the route returns null without a managedManga row, even when
  // a cached cover is on disk). Idempotent: 409 means it's already managed.
  const manageRes = await adminContext.post("/api/manager/manga", {
    data: { anilistId: 30104 },
  });
  if (!manageRes.ok() && manageRes.status() !== 409) {
    throw new Error(`manager add failed: ${await manageRes.text()}`);
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
