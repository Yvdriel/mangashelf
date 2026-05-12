# MangaShelf Regular-User Discovery Pass

## Application Overview

MangaShelf is a self-hosted manga reader and manager running at http://localhost:3100. This plan covers every flow discoverable by a regular (non-admin) authenticated user — Regular User (user@test.local). The regular user has a narrower surface than admin: the global nav shows only the Library link; Manager, Downloads, Scan Library, DownloadIndicator, and GlobalDownloadProgress are all hidden. The user menu shows only Account Settings and Sign Out (no Admin Panel or System Status). The library landing page omits the Select / multi-delete button. All admin-only API routes return HTTP 403. Three page-level admin routes (/settings/admin, /manager/import, /system/status) redirect to / rather than to /login. The /manager and /downloads pages load for regular users (proxy-only auth, no page-level role check) but every API action they invoke is admin-gated and returns 403. A session-invalidation side-effect was observed: attempting a password change (even with a wrong current password) invalidated the active session, forcing a re-login.

## Test Scenarios

### 1. reader-library

**Seed:** `tests/seed-regular-user.spec.ts`

#### 1.1. library landing shows empty-state when no manga exists

**File:** `tests/regular-user/reader-library/empty-state.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/
    - expect: URL remains http://localhost:3100/
    - expect: Page title is 'MangaShelf'
    - expect: Heading 'Library' (h1) is visible
    - expect: Paragraph 'No manga found.' is visible
    - expect: Paragraph 'Place manga folders in your MANGA_DIR and click Scan Library.' is visible
  2. Verify the global navigation contains only the logo link and the 'Library' link; confirm that 'Manager', 'Downloads', and 'Scan Library' are absent
    - expect: Nav contains exactly one named link: 'Library'
    - expect: No 'Manager' link is present
    - expect: No 'Downloads' link is present
    - expect: No 'Scan Library' button is present
  3. Verify the 'Select' multi-select button is absent from the library toolbar
    - expect: No button labelled 'Select' or 'Done' is rendered in the toolbar

#### 1.2. library search with empty library returns no results

**File:** `tests/regular-user/reader-library/empty-search.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/
    - expect: Library heading is visible
  2. Type 'test search' into the Search... textbox
    - expect: Search field shows 'test search'
    - expect: The empty-state message 'No manga found.' remains visible (client-side filter over empty data)
  3. Clear the search field
    - expect: Empty-state text reappears unchanged

#### 1.3. library sort options are present and switch without error on empty library

**File:** `tests/regular-user/reader-library/sort-options.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/
    - expect: Sort combobox exists with options: 'Title' (selected), 'Recently Read', 'Recently Added'
  2. Select 'Recently Read' from the sort combobox
    - expect: 'Recently Read' is selected
    - expect: No JavaScript error is thrown
    - expect: Empty-state message remains
  3. Select 'Recently Added' from the sort combobox
    - expect: 'Recently Added' is selected
    - expect: No JavaScript error is thrown
    - expect: Empty-state message remains
  4. Select 'Title' from the sort combobox to restore default
    - expect: 'Title' is selected again

#### 1.4. logo link navigates to library root

**File:** `tests/regular-user/reader-library/logo-link.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/account
    - expect: Account Settings page loads
  2. Click the logo image link in the navigation bar
    - expect: URL changes to http://localhost:3100/
    - expect: Library heading is visible

#### 1.5. accessing /manga/[id] for a non-existent manga shows 404

**File:** `tests/regular-user/reader-library/manga-not-found.spec.ts`

**Steps:**
  1. Navigate directly to http://localhost:3100/manga/999999
    - expect: URL stays at http://localhost:3100/manga/999999 (no redirect)
    - expect: Page title is '404: This page could not be found.'
    - expect: Heading '404' is visible
    - expect: Heading 'This page could not be found.' is visible
    - expect: Global nav is still rendered with Library link and RU user menu

#### 1.6. accessing /manga/[id]/read/[volumeNumber] for non-existent content shows 404

**File:** `tests/regular-user/reader-library/reader-not-found.spec.ts`

**Steps:**
  1. Navigate directly to http://localhost:3100/manga/999999/read/1
    - expect: URL stays at http://localhost:3100/manga/999999/read/1
    - expect: Page title is '404: This page could not be found.'
    - expect: 404 heading is visible

### 2. settings-account

**Seed:** `tests/seed-regular-user.spec.ts`

#### 2.1. account settings page loads with all expected sections

**File:** `tests/regular-user/settings-account/page-loads.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/account
    - expect: URL is /settings/account
    - expect: Heading 'Account Settings' (h1) is visible
    - expect: Section headings are present: 'Theme', 'Reader', 'Text tools', 'AnkiConnect', 'Dictionaries', 'Profile', 'Change Password', 'Two-Factor Authentication', 'Passkeys', 'Active Sessions'

#### 2.2. theme selection buttons are clickable and trigger PUT /api/user/preferences

**File:** `tests/regular-user/settings-account/theme-selection.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/account
    - expect: Theme section is visible with buttons: System, Dark, Chalk, Sakura, AMOLED
  2. Click the 'Dark' theme button
    - expect: PUT /api/user/preferences is called with theme: 'dark'
    - expect: Response status is 200
  3. Click the 'Sakura' theme button
    - expect: PUT /api/user/preferences is called with theme: 'sakura'
    - expect: Response status is 200
  4. Click the 'System' button to restore the default
    - expect: PUT /api/user/preferences is called with theme: 'system'
    - expect: Response status is 200

#### 2.3. OCR overlay toggle triggers preference save

**File:** `tests/regular-user/settings-account/ocr-toggle.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/account
    - expect: Reader section contains a switch labelled 'Japanese OCR overlays' in unchecked state
  2. Click the 'Japanese OCR overlays' switch
    - expect: Switch state toggles to checked
    - expect: PUT /api/user/preferences is called
    - expect: Response is 200 OK with ocrEnabled: true

#### 2.4. strip linebreaks on copy toggle is pre-checked and can be toggled

**File:** `tests/regular-user/settings-account/strip-linebreaks-toggle.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/account
    - expect: 'Strip linebreaks on copy' switch is in checked state by default
  2. Click the 'Strip linebreaks on copy' switch
    - expect: Switch state toggles to unchecked
    - expect: PUT /api/user/preferences is called with copyStripLinebreaks: false
    - expect: Response is 200 OK

#### 2.5. profile display name can be edited and saved

**File:** `tests/regular-user/settings-account/profile-name-save.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/account and scroll to 'Profile' section
    - expect: Email field shows 'user@test.local' and is disabled
    - expect: Display Name field shows 'Regular User' and is editable
    - expect: Profile Save button is disabled
  2. Clear the Display Name field and type a new name e.g. 'RU Test'
    - expect: Display Name field contains 'RU Test'
    - expect: Profile Save button becomes enabled
  3. Click the Profile Save button
    - expect: The auth API is called to update name
    - expect: Save button returns to disabled state after success

#### 2.6. change password form shows error for wrong current password

**File:** `tests/regular-user/settings-account/password-change-wrong-current.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/account and scroll to 'Change Password' section
    - expect: Current Password, New Password, and Confirm New Password fields are visible and empty
    - expect: Change Password button is present
  2. Fill Current Password with 'wrongpassword', New Password with 'newpass123', Confirm New Password with 'newpass123'
    - expect: All fields are filled
  3. Click the 'Change Password' button
    - expect: An error message 'Invalid password' appears inline below the form
    - expect: URL stays at /settings/account

#### 2.7. 2FA enable button is disabled until password is entered

**File:** `tests/regular-user/settings-account/2fa-enable-button.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/account and scroll to 'Two-Factor Authentication' section
    - expect: 'Enable 2FA' button is disabled
    - expect: An 'Enter your password' textbox is present
  2. Type the user's current password 'userpass123' into the 'Enter your password' field
    - expect: 'Enable 2FA' button becomes enabled

#### 2.8. dictionary install buttons are present for all available dictionaries

**File:** `tests/regular-user/settings-account/dictionary-install-buttons.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/account and scroll to 'Dictionaries' section
    - expect: Four dictionary entries are listed: 'Jitendex (JMdict)', 'KANJIDIC2', 'JPDB Frequency', 'BCCWJ Frequency'
    - expect: Each entry has an 'Install' button
    - expect: Description text and license/source links are visible for each dictionary

#### 2.9. active sessions section shows current session

**File:** `tests/regular-user/settings-account/active-sessions.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/account and scroll to 'Active Sessions' section
    - expect: At least one session entry is listed
    - expect: The entry is marked 'Current'
    - expect: Session details include a date starting with today's date (e.g., 'Since 5/12/2026')

#### 2.10. AnkiConnect settings can be modified and Save button activates

**File:** `tests/regular-user/settings-account/anki-settings.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/account and scroll to 'AnkiConnect' section
    - expect: AnkiConnect enable switch is unchecked
    - expect: Deck field shows 'Mining'
    - expect: AnkiConnect Save button is disabled
    - expect: 'Test connection' button is visible and enabled
  2. Change the Deck field value from 'Mining' to 'Japanese Mining'
    - expect: Deck field shows 'Japanese Mining'
    - expect: Save button becomes enabled

#### 2.11. passkey registration button is present

**File:** `tests/regular-user/settings-account/passkey-button.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/account and scroll to 'Passkeys' section
    - expect: Heading 'Passkeys' is visible
    - expect: Description 'Use biometrics or a security key for passwordless sign-in.' is present
    - expect: 'Register New Passkey' button is present and enabled

### 3. manager-readonly

**Seed:** `tests/seed-regular-user.spec.ts`

#### 3.1. /manager page loads and shows empty managed library state

**File:** `tests/regular-user/manager-readonly/manager-empty-state.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/manager
    - expect: URL is /manager
    - expect: Page renders without redirect
    - expect: 'Managed Library' heading (h2) is visible
    - expect: Empty-state paragraph 'No manga added yet. Search AniList above to get started.' is visible
    - expect: AniList search textbox 'Search AniList for manga...' is present
    - expect: 'Manual Import' link is present pointing to /manager/import

#### 3.2. AniList search in /manager silently fails with 403 for regular user (no UI error shown)

**File:** `tests/regular-user/manager-readonly/manager-search-403.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/manager
    - expect: Manager page loads
  2. Type 'Naruto' into the 'Search AniList for manga...' textbox and wait 2 seconds
    - expect: GET /api/manager/search?q=Naruto returns HTTP 403 in the network log
    - expect: No search results are displayed in the UI
    - expect: No user-visible error message or toast appears on screen
    - expect: The empty-state paragraph remains visible

#### 3.3. Manual Import link on /manager redirects regular user to /

**File:** `tests/regular-user/manager-readonly/manual-import-redirect.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/manager
    - expect: Manager page loads with 'Manual Import' link
  2. Click the 'Manual Import' link
    - expect: URL changes to http://localhost:3100/ (redirected from /manager/import)
    - expect: Library heading is visible

#### 3.4. /manager/[id] for non-existent managed manga shows 404

**File:** `tests/regular-user/manager-readonly/manager-id-not-found.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/manager/999999
    - expect: URL stays at /manager/999999
    - expect: 404 page is rendered with heading '404'
    - expect: Global nav is still present

### 4. downloads-page

**Seed:** `tests/seed-regular-user.spec.ts`

#### 4.1. /downloads page loads and shows empty download state

**File:** `tests/regular-user/downloads-page/downloads-empty-state.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/downloads
    - expect: URL is /downloads
    - expect: Page renders without redirect
    - expect: Heading 'Downloads' (h1) is visible
    - expect: Empty-state message 'No active downloads' is visible
    - expect: 'Go to Manager' link is present and points to /manager

#### 4.2. /downloads page fetches /api/downloads/status on load

**File:** `tests/regular-user/downloads-page/downloads-api-call.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/downloads
    - expect: GET /api/downloads/status is called and returns HTTP 200
    - expect: Response body contains: active: [], bulk: [], recent: [], importing: false, scanning: false, hasActiveDownloads: false

#### 4.3. 'Go to Manager' link navigates to /manager

**File:** `tests/regular-user/downloads-page/go-to-manager-link.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/downloads
    - expect: Downloads empty-state is visible with 'Go to Manager' link
  2. Click the 'Go to Manager' link
    - expect: URL changes to http://localhost:3100/manager
    - expect: Manager page is rendered with 'Managed Library' heading

### 5. user-menu-nav

**Seed:** `tests/seed-regular-user.spec.ts`

#### 5.1. user menu opens and shows correct items for regular user

**File:** `tests/regular-user/user-menu-nav/menu-items.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/
    - expect: User menu button showing initials 'RU' is visible in top right of nav
  2. Click the 'RU' user menu button
    - expect: Dropdown opens showing:
    - expect: User name 'Regular User'
    - expect: Email 'user@test.local'
    - expect: 'Account Settings' link pointing to /settings/account
    - expect: 'Sign Out' button
    - expect: NO 'Admin Panel' link
    - expect: NO 'System Status' link
    - expect: NO health badge indicator on the button

#### 5.2. user menu Account Settings link navigates to /settings/account

**File:** `tests/regular-user/user-menu-nav/account-settings-link.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/ and click the 'RU' user menu button to open the dropdown
    - expect: Dropdown is open with 'Account Settings' link visible
  2. Click 'Account Settings'
    - expect: URL changes to /settings/account
    - expect: Account Settings page renders with heading 'Account Settings'

#### 5.3. nav Library link is highlighted when on library page

**File:** `tests/regular-user/user-menu-nav/library-link-active.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/
    - expect: The 'Library' nav link has an active/highlighted style (bg-surface-700 text-accent-300 class applied)
  2. Navigate to http://localhost:3100/settings/account
    - expect: The 'Library' nav link is no longer highlighted

### 6. permission-boundaries

**Seed:** `tests/seed-regular-user.spec.ts`

#### 6.1. /settings/admin redirects regular user to / (not /login)

**File:** `tests/regular-user/permission-boundaries/settings-admin-redirect.spec.ts`

**Steps:**
  1. Navigate directly to http://localhost:3100/settings/admin
    - expect: URL immediately changes to http://localhost:3100/ (redirected by page-level getSession + role check)
    - expect: Library landing page is rendered
    - expect: No admin user-management panel is shown

#### 6.2. /manager/import redirects regular user to /

**File:** `tests/regular-user/permission-boundaries/manager-import-redirect.spec.ts`

**Steps:**
  1. Navigate directly to http://localhost:3100/manager/import
    - expect: URL immediately changes to http://localhost:3100/
    - expect: Library landing page is rendered
    - expect: No ImportWizard component is shown

#### 6.3. /system/status redirects regular user to /

**File:** `tests/regular-user/permission-boundaries/system-status-redirect.spec.ts`

**Steps:**
  1. Navigate directly to http://localhost:3100/system/status
    - expect: URL immediately changes to http://localhost:3100/
    - expect: Library landing page is rendered
    - expect: No system status dashboard is shown

#### 6.4. POST /api/library/scan returns 403 Forbidden for regular user

**File:** `tests/regular-user/permission-boundaries/api-library-scan-403.spec.ts`

**Steps:**
  1. From any authenticated page, send POST /api/library/scan via fetch()
    - expect: HTTP response status is 403
    - expect: Response body is {"error":"Forbidden"}

#### 6.5. GET /api/system/health returns 403 for regular user

**File:** `tests/regular-user/permission-boundaries/api-system-health-403.spec.ts`

**Steps:**
  1. Send GET /api/system/health via fetch()
    - expect: HTTP response status is 403
    - expect: Response body is {"error":"Forbidden"}

#### 6.6. GET /api/system/status returns 403 for regular user

**File:** `tests/regular-user/permission-boundaries/api-system-status-403.spec.ts`

**Steps:**
  1. Send GET /api/system/status via fetch()
    - expect: HTTP response status is 403
    - expect: Response body is {"error":"Forbidden"}

#### 6.7. GET /api/manager/search returns 403 for regular user

**File:** `tests/regular-user/permission-boundaries/api-manager-search-403.spec.ts`

**Steps:**
  1. Send GET /api/manager/search?q=naruto via fetch()
    - expect: HTTP response status is 403
    - expect: Response body is {"error":"Forbidden"}

#### 6.8. GET /api/manager/manga returns 403 for regular user

**File:** `tests/regular-user/permission-boundaries/api-manager-manga-get-403.spec.ts`

**Steps:**
  1. Send GET /api/manager/manga via fetch()
    - expect: HTTP response status is 403
    - expect: Response body is {"error":"Forbidden"}

#### 6.9. POST /api/manager/manga returns 403 for regular user

**File:** `tests/regular-user/permission-boundaries/api-manager-manga-post-403.spec.ts`

**Steps:**
  1. Send POST /api/manager/manga with body {anilistId: 12345} via fetch()
    - expect: HTTP response status is 403
    - expect: Response body is {"error":"Forbidden"}

#### 6.10. POST /api/delete returns 403 for regular user

**File:** `tests/regular-user/permission-boundaries/api-delete-403.spec.ts`

**Steps:**
  1. Send POST /api/delete with body {mangaIds: []} via fetch()
    - expect: HTTP response status is 403
    - expect: Response body is {"error":"Forbidden"}

#### 6.11. POST /api/manager/import (orphan) returns 403 for regular user

**File:** `tests/regular-user/permission-boundaries/api-manager-import-post-403.spec.ts`

**Steps:**
  1. Send POST /api/manager/import via fetch()
    - expect: HTTP response status is 403
    - expect: Response body is {"error":"Forbidden"}

#### 6.12. GET /api/manager/downloads (orphan) returns 403 for regular user

**File:** `tests/regular-user/permission-boundaries/api-manager-downloads-403.spec.ts`

**Steps:**
  1. Send GET /api/manager/downloads via fetch()
    - expect: HTTP response status is 403
    - expect: Response body is {"error":"Forbidden"}

#### 6.13. POST /api/manager/monitor/run returns 403 for regular user

**File:** `tests/regular-user/permission-boundaries/api-manager-monitor-run-403.spec.ts`

**Steps:**
  1. Send POST /api/manager/monitor/run via fetch()
    - expect: HTTP response status is 403
    - expect: Response body is {"error":"Forbidden"}

#### 6.14. GET /api/import/history returns 403 (body: Unauthorized) for regular user

**File:** `tests/regular-user/permission-boundaries/api-import-history-403.spec.ts`

**Steps:**
  1. Send GET /api/import/history via fetch()
    - expect: HTTP response status is 403
    - expect: Response body is {"error":"Unauthorized"} (note: different error text from other admin routes which return 'Forbidden')

#### 6.15. GET /api/import/browse returns 403 (body: Unauthorized) for regular user

**File:** `tests/regular-user/permission-boundaries/api-import-browse-403.spec.ts`

**Steps:**
  1. Send GET /api/import/browse via fetch()
    - expect: HTTP response status is 403
    - expect: Response body is {"error":"Unauthorized"} (note: different error text from routes using requireAdmin which return 'Forbidden')

#### 6.16. authenticated user is redirected from /login to /

**File:** `tests/regular-user/permission-boundaries/authed-user-login-redirect.spec.ts`

**Steps:**
  1. While authenticated as regular user, navigate to http://localhost:3100/login
    - expect: URL immediately changes to http://localhost:3100/
    - expect: Library page renders; login form is not shown

#### 6.17. authenticated user is redirected from /setup to /

**File:** `tests/regular-user/permission-boundaries/authed-user-setup-redirect.spec.ts`

**Steps:**
  1. While authenticated as regular user, navigate to http://localhost:3100/setup
    - expect: URL immediately changes to http://localhost:3100/
    - expect: Library page renders; setup form is not shown

### 7. session-apis

**Seed:** `tests/seed-regular-user.spec.ts`

#### 7.1. GET /api/user/preferences returns 200 with full preferences object

**File:** `tests/regular-user/session-apis/get-user-preferences.spec.ts`

**Steps:**
  1. Send GET /api/user/preferences via fetch()
    - expect: HTTP status is 200
    - expect: Response JSON contains keys: theme, ocrEnabled, copyStripLinebreaks, textViewButton, ankiSettings
    - expect: ankiSettings contains: enabled, url, deck, model, fields, tags, imageFormat, jpegQuality, cropPadding, mode, showPreviewDialog

#### 7.2. PUT /api/user/preferences updates theme and returns updated preferences

**File:** `tests/regular-user/session-apis/put-user-preferences.spec.ts`

**Steps:**
  1. Send PUT /api/user/preferences with body {theme: 'dark'} via fetch()
    - expect: HTTP status is 200
    - expect: Response JSON contains theme: 'dark'
    - expect: Other preference fields are returned unchanged

#### 7.3. GET /api/downloads/status returns 200 with empty download summary

**File:** `tests/regular-user/session-apis/get-downloads-status.spec.ts`

**Steps:**
  1. Send GET /api/downloads/status via fetch()
    - expect: HTTP status is 200
    - expect: Response JSON contains: active: [], bulk: [], recent: [], importing: false, scanning: false, hasActiveDownloads: false
    - expect: summary object contains: activeCount: 0, bulkCount: 0, recentCount: 0

#### 7.4. GET /api/manga (Session orphan) returns 200 with empty array when library is empty

**File:** `tests/regular-user/session-apis/get-manga-list.spec.ts`

**Steps:**
  1. Send GET /api/manga via fetch()
    - expect: HTTP status is 200
    - expect: Response JSON is an empty array []

#### 7.5. password change with wrong current password triggers session invalidation

**File:** `tests/regular-user/session-apis/password-change-session-invalidation.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/account and scroll to the Change Password section
    - expect: Change Password form fields are visible
  2. Fill Current Password with an incorrect password (e.g. 'wrongpassword'), New Password with 'newpass123', Confirm New Password with 'newpass123', then click 'Change Password'
    - expect: The auth endpoint is called
    - expect: An 'Invalid password' error message appears below the form fields
    - expect: OBSERVE: After a short delay the session may be invalidated — navigating to another protected route (e.g. /manga/1) may redirect to /login even though the password change failed. This is a documented side-effect; testers should re-authenticate as user@test.local / userpass123 after this step.
