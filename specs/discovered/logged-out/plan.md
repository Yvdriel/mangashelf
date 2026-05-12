# MangaShelf Logged-Out Public Flow Test Plan

## Application Overview

MangaShelf is a self-hosted manga reader and manager running at http://localhost:3100. When no session cookie is present, all routes except /login, /setup, and /api/auth/* are gated by src/proxy.ts, which redirects to /login (when users exist in the DB) or /setup (when no users exist). This pass explores every public flow reachable without authentication: the /login page (email/password form, passkey button, 2FA TOTP path, loading-spinner transient state, wrong-credentials error), the /setup page (account creation form with password mismatch and short-password validation), the /api/auth/setup-status JSON endpoint, and representative protected routes (/, /manager, /settings/admin) to confirm they are correctly gate-kept. No login is performed and no storage state is modified during this pass. One environment-specific finding was recorded: during test execution the proxy's SQLite query and the setup-status API route may disagree on the user count (proxy sees 0 users → redirects to /setup; API returns needsSetup:false → users exist), which points to a potential multi-process WAL-mode SQLite inconsistency. A React hydration mismatch warning is also emitted on the login page, caused by the conditional passkey-button render diverging between SSR and client.

## Test Scenarios

### 1. auth-page-render

**Seed:** `tests/seed-logged-out.spec.ts`

#### 1.1. Login page renders heading and email/password form

**File:** `tests/logged-out/auth-page-render/login-page-structure.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/login with no session cookie.
    - expect: URL stays at /login (no redirect).
    - expect: Page title is 'MangaShelf'.
    - expect: An h1 heading 'MangaShelf' is visible.
    - expect: A paragraph 'Sign in to your account' is visible.
    - expect: An email input with placeholder 'you@example.com' is visible.
    - expect: A password input with placeholder 'Your password' is visible.
    - expect: A submit button labelled 'Sign In' is visible.

#### 1.2. Login page shows passkey button when browser supports PublicKeyCredential

**File:** `tests/logged-out/auth-page-render/login-passkey-button.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/login.
    - expect: The page renders without a full-page error.
  2. Evaluate window.PublicKeyCredential in the browser context to check passkey support.
    - expect: If PublicKeyCredential is defined, a 'Sign in with Passkey' button is present above the email/password form.
    - expect: An 'or' divider separates the passkey button from the email/password form.
    - expect: If PublicKeyCredential is undefined, the passkey button and divider are absent.

#### 1.3. Login page shows transient loading spinner before setup-status resolves

**File:** `tests/logged-out/auth-page-render/login-loading-state.spec.ts`

**Steps:**
  1. Intercept GET /api/auth/setup-status and delay the response by 2 seconds. Navigate to /login.
    - expect: While the request is pending, the form area shows a spinning indicator (div with animate-spin class) instead of the email/password fields.
  2. Let the intercepted response complete with body { needsSetup: false }.
    - expect: The spinner disappears and the full email/password form (and passkey button if supported) becomes visible.

#### 1.4. Login page redirects to /setup when setup-status returns needsSetup:true

**File:** `tests/logged-out/auth-page-render/login-redirects-when-needs-setup.spec.ts`

**Steps:**
  1. Intercept GET /api/auth/setup-status and return { needsSetup: true }. Navigate to /login.
    - expect: After the status resolves, the router replaces the current URL with /setup.
    - expect: The setup account-creation form is displayed.

#### 1.5. Setup page renders account creation form

**File:** `tests/logged-out/auth-page-render/setup-page-structure.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/setup with no session cookie and no users in the database.
    - expect: URL stays at /setup.
    - expect: Page title is 'MangaShelf'.
    - expect: An h1 heading 'MangaShelf' is visible.
    - expect: A paragraph 'Welcome! Create your admin account to get started.' is visible.
    - expect: A text input with placeholder 'Your name' (Display Name) is visible.
    - expect: An email input with placeholder 'admin@example.com' is visible.
    - expect: A password input with placeholder 'At least 8 characters' is visible.
    - expect: A second password input with placeholder 'Repeat your password' (Confirm Password) is visible.
    - expect: A submit button labelled 'Create Admin Account' is visible.

#### 1.6. Setup page redirects to /login when users already exist in the database

**File:** `tests/logged-out/auth-page-render/setup-redirects-when-provisioned.spec.ts`

**Steps:**
  1. Ensure at least one user row exists in the database (e.g. by running the auth.setup.ts seed). Navigate to http://localhost:3100/setup with no session cookie.
    - expect: The server-side component detects userCount > 0 and issues a redirect to /login.
    - expect: The final URL is /login.
    - expect: The login form is rendered rather than the setup account-creation form.

### 2. auth-rejections

**Seed:** `tests/seed-logged-out.spec.ts`

#### 2.1. Login form shows inline error on wrong credentials

**File:** `tests/logged-out/auth-rejections/login-wrong-credentials.spec.ts`

**Steps:**
  1. Navigate to /login.
    - expect: The login form is fully rendered.
  2. Fill the email field with 'wrong@example.com' and the password field with 'wrongpassword'. Click the 'Sign In' button.
    - expect: The button label changes to 'Signing in...' while the request is in flight.
    - expect: A POST to /api/auth/sign-in/email returns HTTP 401.
    - expect: An inline error message 'Invalid email or password' appears between the password field and the Sign In button.
    - expect: The URL remains /login.
    - expect: The email and password fields retain their entered values.

#### 2.2. Login form enforces required fields via browser native validation

**File:** `tests/logged-out/auth-rejections/login-empty-fields.spec.ts`

**Steps:**
  1. Navigate to /login. Leave the email and password fields empty. Click the 'Sign In' button.
    - expect: The browser's native required-field validation fires.
    - expect: The email field receives focus (browser tooltip or outline).
    - expect: No network request to /api/auth/sign-in/email is made.
    - expect: The URL stays at /login.

#### 2.3. Setup form shows inline error when passwords do not match

**File:** `tests/logged-out/auth-rejections/setup-password-mismatch.spec.ts`

**Steps:**
  1. Navigate to /setup. Fill Display Name with 'Test User', Email with 'test@example.com', Password with 'password123', and Confirm Password with 'differentpassword'. Click 'Create Admin Account'.
    - expect: No network request is made to the auth sign-up endpoint.
    - expect: An inline error message 'Passwords do not match' appears within the form.
    - expect: All four fields retain their entered values.
    - expect: The URL stays at /setup.

#### 2.4. Setup form shows inline error when password is shorter than 8 characters

**File:** `tests/logged-out/auth-rejections/setup-short-password.spec.ts`

**Steps:**
  1. Navigate to /setup. Fill Display Name with 'Test User', Email with 'test@example.com', Password with 'abc', and Confirm Password with 'abc'. Click 'Create Admin Account'.
    - expect: Passwords match so the mismatch error does not appear.
    - expect: The client-side length check fires before any network call.
    - expect: An inline error message 'Password must be at least 8 characters' appears within the form.
    - expect: The URL stays at /setup.

#### 2.5. Setup form enforces required fields via browser native validation

**File:** `tests/logged-out/auth-rejections/setup-empty-fields.spec.ts`

**Steps:**
  1. Navigate to /setup. Leave all fields empty. Click 'Create Admin Account'.
    - expect: The browser's native required-field validation fires.
    - expect: The Display Name field receives focus.
    - expect: No network request is made.
    - expect: The URL stays at /setup.

#### 2.6. Login page TOTP 2FA state appears after successful email sign-in challenge

**File:** `tests/logged-out/auth-rejections/login-2fa-state.spec.ts`

**Steps:**
  1. Intercept POST /api/auth/sign-in/email and return a stubbed response body containing twoFactorRedirect: true. Navigate to /login. Fill valid-looking credentials and submit.
    - expect: The form transitions to the 2FA state.
    - expect: The email/password form is hidden.
    - expect: A paragraph 'Enter the 6-digit code from your authenticator app' is visible.
    - expect: A single numeric text input with placeholder '000000' is visible.
    - expect: A 'Verify' button is visible but disabled (requires 6 digits).
    - expect: A 'Back to login' button is visible.
  2. Click the 'Back to login' button.
    - expect: The 2FA form is replaced by the email/password form.
    - expect: The URL stays at /login.

#### 2.7. Login TOTP verify button is disabled until exactly 6 digits are entered

**File:** `tests/logged-out/auth-rejections/login-2fa-totp-length.spec.ts`

**Steps:**
  1. Reach the 2FA state (by stubbing the sign-in response as in the previous test). Type '12345' (5 digits) into the TOTP code input.
    - expect: The 'Verify' button remains disabled.
  2. Type a 6th digit to complete '123456'.
    - expect: The 'Verify' button becomes enabled.
  3. Type a non-digit character (e.g. 'a') into the TOTP input.
    - expect: The non-digit character is stripped; the input value does not change.

### 3. redirect-gates

**Seed:** `tests/seed-logged-out.spec.ts`

#### 3.1. Root path / redirects unauthenticated user — to /login when users exist

**File:** `tests/logged-out/redirect-gates/root-redirects-to-login.spec.ts`

**Steps:**
  1. Ensure the database has at least one user (run auth.setup.ts seed). Clear all cookies. Navigate to http://localhost:3100/.
    - expect: The proxy intercepts the request (no session cookie, users exist).
    - expect: The response is a redirect to /login.
    - expect: The final URL is /login.
    - expect: The login form is displayed.

#### 3.2. Root path / redirects unauthenticated user — to /setup when no users exist

**File:** `tests/logged-out/redirect-gates/root-redirects-to-setup.spec.ts`

**Steps:**
  1. Ensure the database has zero users. Clear all cookies. Navigate to http://localhost:3100/.
    - expect: The proxy intercepts the request (no session cookie, no users).
    - expect: The response is a redirect to /setup.
    - expect: The final URL is /setup.
    - expect: The account-creation form is displayed.

#### 3.3. /manager redirects unauthenticated user to /login or /setup

**File:** `tests/logged-out/redirect-gates/manager-redirects.spec.ts`

**Steps:**
  1. Clear all cookies. Navigate to http://localhost:3100/manager.
    - expect: The proxy detects no session cookie.
    - expect: The response is a redirect. Final URL is either /login (if users exist) or /setup (if no users exist).
    - expect: The manager content (managed manga list) is not shown.

#### 3.4. /settings/admin redirects unauthenticated user to /login or /setup

**File:** `tests/logged-out/redirect-gates/settings-admin-redirects.spec.ts`

**Steps:**
  1. Clear all cookies. Navigate to http://localhost:3100/settings/admin.
    - expect: The proxy detects no session cookie.
    - expect: The response is a redirect. Final URL is either /login (if users exist) or /setup (if no users exist).
    - expect: The admin user-management panel is not shown.

#### 3.5. /downloads redirects unauthenticated user to /login or /setup

**File:** `tests/logged-out/redirect-gates/downloads-redirects.spec.ts`

**Steps:**
  1. Clear all cookies. Navigate to http://localhost:3100/downloads.
    - expect: The proxy detects no session cookie.
    - expect: The response is a redirect. Final URL is either /login (if users exist) or /setup (if no users exist).
    - expect: The downloads list is not shown.

#### 3.6. /manga/[id] redirects unauthenticated user to /login or /setup

**File:** `tests/logged-out/redirect-gates/manga-detail-redirects.spec.ts`

**Steps:**
  1. Clear all cookies. Navigate to http://localhost:3100/manga/1.
    - expect: The proxy detects no session cookie.
    - expect: The response is a redirect. Final URL is either /login (if users exist) or /setup (if no users exist).
    - expect: No manga details are rendered.

#### 3.7. /settings/account redirects unauthenticated user to /login or /setup

**File:** `tests/logged-out/redirect-gates/settings-account-redirects.spec.ts`

**Steps:**
  1. Clear all cookies. Navigate to http://localhost:3100/settings/account.
    - expect: The proxy detects no session cookie.
    - expect: The response is a redirect. Final URL is either /login (if users exist) or /setup (if no users exist).
    - expect: The account settings form is not shown.

### 4. public-api

**Seed:** `tests/seed-logged-out.spec.ts`

#### 4.1. /api/auth/setup-status returns { needsSetup: false } when users exist

**File:** `tests/logged-out/public-api/setup-status-provisioned.spec.ts`

**Steps:**
  1. Ensure at least one user exists in the database. With no session cookie, issue a GET request to http://localhost:3100/api/auth/setup-status.
    - expect: Response status is 200.
    - expect: Response Content-Type includes 'application/json'.
    - expect: Response body is exactly { "needsSetup": false }.

#### 4.2. /api/auth/setup-status returns { needsSetup: true } when no users exist

**File:** `tests/logged-out/public-api/setup-status-empty.spec.ts`

**Steps:**
  1. Ensure zero users exist in the database. With no session cookie, issue a GET request to /api/auth/setup-status.
    - expect: Response status is 200.
    - expect: Response body is exactly { "needsSetup": true }.

#### 4.3. /api/auth/get-session returns null body for unauthenticated request

**File:** `tests/logged-out/public-api/better-auth-get-session-unauth.spec.ts`

**Steps:**
  1. With no session cookie, issue a GET request to /api/auth/get-session (Better Auth catch-all handler).
    - expect: Response status is 200.
    - expect: Response body is the JSON literal null.
    - expect: No session data is leaked.

#### 4.4. /api/auth/sign-in/email returns 401 for invalid credentials

**File:** `tests/logged-out/public-api/better-auth-sign-in-invalid.spec.ts`

**Steps:**
  1. With no session cookie, POST to /api/auth/sign-in/email with JSON body { email: 'nobody@example.com', password: 'badpassword' }.
    - expect: Response status is 401.
    - expect: Response body contains an error message (e.g. 'Invalid email or password').

#### 4.5. Session-required API route returns redirect or 401 without a cookie

**File:** `tests/logged-out/public-api/session-required-api-gated.spec.ts`

**Steps:**
  1. With no session cookie, issue a GET request to /api/downloads/status.
    - expect: Response is either a 3xx redirect to /login or /setup, or a 401/403 status.
    - expect: No download data payload is returned in the body.
