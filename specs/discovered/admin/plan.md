# MangaShelf Admin Test Plan

## Application Overview

MangaShelf is a self-hosted manga reader and manager. The admin role has full access to all pages including the User Management panel (/settings/admin), System Status dashboard (/system/status), Manual Import wizard (/manager/import), and all admin-only API mutations. The E2E test environment runs at http://localhost:3100 with E2E=1, an empty manga fixture at .test-data/manga, a SQLite database at .test-data/test.db, and Jackett/Deluge stubbed to 127.0.0.1:1 (so service-down states are expected, not findings). Two seeded users exist: admin@test.local (role=admin) and user@test.local (role=user). The admin session is provided via playwright/.auth/user.json. These tests authenticate as admin and cover all admin-only surfaces, shared surfaces still accessible as admin, empty/loading/error states, and stubbed-service graceful degradation.

## Test Scenarios

### 1. admin-panel-user-management

**Seed:** `tests/seed-admin.spec.ts`

#### 1.1. Admin panel loads with correct user list

**File:** `tests/admin/user-management/admin-panel-loads.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/admin
    - expect: Page URL is /settings/admin
    - expect: Heading 'User Management' is visible
    - expect: Counter shows '2 users'
    - expect: Admin user row shows initials 'TA', name 'Test Admin', role badge 'Admin', email 'admin@test.local'
    - expect: Regular user row shows initials 'RU', name 'Regular User', email 'user@test.local' with no role badge
    - expect: Search textbox 'Search by email...' is present
    - expect: 'Create User' button is present
  2. Confirm GET /api/auth/admin/list-users?limit=100&offset=0 is called and returns HTTP 200 with JSON { users: [...], total: 2, limit: 100 }
    - expect: Response contains two user objects with fields: id, name, email, role, banned, twoFactorEnabled, createdAt
    - expect: admin@test.local has role='admin', banned=false
    - expect: user@test.local has role='user', banned=false

#### 1.2. Email search filter narrows user list

**File:** `tests/admin/user-management/search-filter.spec.ts`

**Steps:**
  1. Navigate to /settings/admin
    - expect: '2 users' count is visible
  2. Type 'admin' into the 'Search by email...' textbox
    - expect: Counter updates to '1 user'
    - expect: Only admin@test.local row is visible
    - expect: user@test.local row is hidden
  3. Clear the search box (empty string)
    - expect: Counter returns to '2 users'
    - expect: Both user rows are visible again
  4. Type a string that matches no user, e.g. 'nobody@nowhere.com'
    - expect: Counter shows '0 users' or no user rows are rendered

#### 1.3. Create User form opens, validates, and submits

**File:** `tests/admin/user-management/create-user-form.spec.ts`

**Steps:**
  1. Navigate to /settings/admin
    - expect: 'Create User' button is visible and the create form is NOT visible
  2. Click the 'Create User' button
    - expect: The inline form expands with heading 'Create New User'
    - expect: Fields present: Name (text), Email (text), Password (text/password), Role dropdown with options 'User' and 'Admin' (default 'User')
    - expect: 'Create' button and 'Cancel' button are visible
  3. Click 'Cancel' without filling any fields
    - expect: The create form collapses and is no longer visible
  4. Click 'Create User' again. Fill Name='Flow Test User', Email='flow-test-1747000000@test.local', Password='TestPass123!', leave Role='User'. Click 'Create'.
    - expect: POST /api/auth/admin/create-user (or equivalent Better-Auth admin endpoint) is called
    - expect: The form collapses on success
    - expect: User count increases to '3 users'
    - expect: New user row with email 'flow-test-1747000000@test.local' appears in the list

#### 1.4. Create User form — validation: empty fields

**File:** `tests/admin/user-management/create-user-validation.spec.ts`

**Steps:**
  1. Navigate to /settings/admin. Click 'Create User'. Leave all fields empty. Click 'Create'.
    - expect: The form does NOT submit (no network request to create user is made, or server returns an error)
    - expect: The form remains open with an error indication for required fields
  2. Fill only the Email field with an invalid address (e.g. 'notanemail'). Click 'Create'.
    - expect: Validation error is shown for the email format
    - expect: No user is created

#### 1.5. Create admin role user via role dropdown

**File:** `tests/admin/user-management/create-admin-role-user.spec.ts`

**Steps:**
  1. Navigate to /settings/admin. Click 'Create User'. Fill Name='Flow Admin User', Email='flow-admin-1747000000@test.local', Password='TestPass123!'. Change Role dropdown to 'Admin'. Click 'Create'.
    - expect: New user row appears with role badge 'Admin'
    - expect: User count increases by 1
  2. Click the action button (gear/chevron icon) next to the newly created admin user row
    - expect: Dropdown shows 'Demote to User', 'Ban User', 'Revoke Sessions', 'Delete User'
    - expect: 'Promote to Admin' is NOT shown (user is already admin)
  3. Click 'Delete User' to remove the throwaway admin user
    - expect: A confirmation dialog or immediate deletion occurs
    - expect: Throwaway user row is removed from the list
    - expect: User count decreases by 1

#### 1.6. User row action menu — regular user options

**File:** `tests/admin/user-management/user-row-actions-regular.spec.ts`

**Steps:**
  1. Navigate to /settings/admin. Click the action icon button on the 'user@test.local' row.
    - expect: Dropdown menu appears with exactly 4 options: 'Promote to Admin', 'Ban User', 'Revoke Sessions', 'Delete User'
    - expect: 'Demote to User' is NOT shown (user is already a regular user)
  2. Click outside the dropdown or press Escape to close it
    - expect: Dropdown closes without any changes

#### 1.7. User row action menu — admin user options

**File:** `tests/admin/user-management/user-row-actions-admin.spec.ts`

**Steps:**
  1. Navigate to /settings/admin. Click the action icon button on the 'admin@test.local' row.
    - expect: Dropdown menu appears with exactly 4 options: 'Demote to User', 'Ban User', 'Revoke Sessions', 'Delete User'
    - expect: 'Promote to Admin' is NOT shown (user is already admin)
  2. Click outside the dropdown to close it without taking action
    - expect: Dropdown closes; no changes to admin@test.local

#### 1.8. Promote regular user to admin and demote back

**File:** `tests/admin/user-management/promote-demote-user.spec.ts`

**Steps:**
  1. Navigate to /settings/admin. Create a throwaway user 'flow-test-1747000001@test.local' with role 'User'. Click the action button on the throwaway user row. Click 'Promote to Admin'.
    - expect: API call is made to update the user's role to admin
    - expect: The role badge on the throwaway user row updates to 'Admin'
    - expect: The action menu for this user now shows 'Demote to User' instead of 'Promote to Admin'
  2. Click the action button on the same user row. Click 'Demote to User'.
    - expect: The role badge removes 'Admin' label
    - expect: The action menu now shows 'Promote to Admin'
  3. Click the action button. Click 'Delete User' to clean up the throwaway user.
    - expect: Throwaway user row is removed; user count decreases

#### 1.9. Ban User and Revoke Sessions actions

**File:** `tests/admin/user-management/ban-revoke-actions.spec.ts`

**Steps:**
  1. Navigate to /settings/admin. Create a throwaway user 'flow-test-ban-1747000000@test.local'. Click action button on that row. Click 'Revoke Sessions'.
    - expect: An API call is made (e.g. POST to a revoke-sessions endpoint)
    - expect: A success notification or visual feedback is shown
    - expect: The user list remains unchanged (user is not deleted, just sessions cleared)
  2. Click action button on the same throwaway user. Click 'Ban User'.
    - expect: An API call is made to ban the user
    - expect: A success notification or visual feedback is shown
    - expect: The user row may show a 'Banned' indicator
  3. Click action button on the banned throwaway user. Click 'Delete User' to clean up.
    - expect: Throwaway user is removed; user count decreases

#### 1.10. Delete throwaway user — full create-and-delete flow

**File:** `tests/admin/user-management/create-then-delete-user.spec.ts`

**Steps:**
  1. Navigate to /settings/admin. Note the current user count. Click 'Create User'. Fill Name='Flow Delete Test', Email='flow-test-delete-1747000000@test.local', Password='TestPass123!'. Click 'Create'.
    - expect: User count increases by 1
    - expect: New user row appears
  2. Click the action button on the 'flow-test-delete-1747000000@test.local' row. Click 'Delete User'.
    - expect: A confirmation prompt or modal may appear — accept it
    - expect: The row is removed from the list
    - expect: User count returns to the value noted at the start

### 2. library-scan

**Seed:** `tests/seed-admin.spec.ts`

#### 2.1. Library landing empty state displays correctly for admin

**File:** `tests/admin/library/empty-state.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/
    - expect: Heading 'Library' is visible
    - expect: Empty state message 'No manga found.' is displayed
    - expect: Hint text 'Place manga folders in your MANGA_DIR and click Scan Library.' is displayed
    - expect: Search textbox 'Search...' is present
    - expect: Sort dropdown shows options: Title, Recently Read, Recently Added
    - expect: 'Select' button is present (admin sees this for bulk-select mode)

#### 2.2. Admin nav shows Scan Library button; regular user does not

**File:** `tests/admin/library/scan-library-button-visible.spec.ts`

**Steps:**
  1. Navigate to / as admin
    - expect: 'Scan Library' button is visible in the top navigation bar
    - expect: The button contains an icon and the text 'Scan Library'

#### 2.3. Scan Library button triggers POST /api/library/scan and returns 200

**File:** `tests/admin/library/scan-library-trigger.spec.ts`

**Steps:**
  1. Navigate to /
    - expect: 'Scan Library' button is visible
  2. Click the 'Scan Library' button
    - expect: POST /api/library/scan is called
    - expect: Response is HTTP 200 with body { added: 0, updated: 0, removed: 0 } (test env is empty)
    - expect: Button may briefly enter a loading/disabled state while the request is in flight
    - expect: After completion, the library view refreshes (still shows 'No manga found.' in empty test env)

#### 2.4. Library sort dropdown changes sort order

**File:** `tests/admin/library/sort-dropdown.spec.ts`

**Steps:**
  1. Navigate to /. Open the sort dropdown (default 'Title').
    - expect: Dropdown lists: 'Title', 'Recently Read', 'Recently Added'
    - expect: 'Title' is the default selected option
  2. Select 'Recently Read'
    - expect: Dropdown shows 'Recently Read' as selected
    - expect: The library content re-renders (empty state still shown since no manga exists)
  3. Select 'Recently Added'
    - expect: Dropdown shows 'Recently Added' as selected

#### 2.5. Library select mode enters and exits cleanly

**File:** `tests/admin/library/select-mode.spec.ts`

**Steps:**
  1. Navigate to /. Click the 'Select' button.
    - expect: Button label changes to 'Done'
    - expect: UI enters bulk-select mode (checkboxes would appear on manga cards if any existed)
  2. Click the 'Done' button
    - expect: Button label returns to 'Select'
    - expect: Bulk-select mode is exited

#### 2.6. Library search textbox filters in real-time

**File:** `tests/admin/library/search-textbox.spec.ts`

**Steps:**
  1. Navigate to /. Type 'nonexistent title xyz' into the 'Search...' textbox.
    - expect: Empty state 'No manga found.' is still shown (test env is empty regardless of query)
    - expect: No JavaScript error is thrown

### 3. manager-search-and-add

**Seed:** `tests/seed-admin.spec.ts`

#### 3.1. Manager page loads with empty managed library and search field

**File:** `tests/admin/manager/manager-empty-state.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/manager
    - expect: AniList search textbox 'Search AniList for manga...' is visible
    - expect: Section heading 'Managed Library' is visible
    - expect: Link 'Manual Import' is visible linking to /manager/import
    - expect: Empty state text 'No manga added yet. Search AniList above to get started.' is displayed

#### 3.2. AniList search returns results via /api/manager/search

**File:** `tests/admin/manager/anilist-search-results.spec.ts`

**Steps:**
  1. Navigate to /manager. Type 'naruto' into the 'Search AniList for manga...' textbox. Wait approximately 800ms for debounce.
    - expect: GET /api/manager/search?q=naruto is called and returns HTTP 200
    - expect: A grid of manga cards appears above the 'Managed Library' section
    - expect: Each card shows: cover image, score percentage badge (e.g. '79%'), Japanese title, romanized title, volume count (e.g. '72 vol'), status (e.g. 'finished'), and an 'Add to Library' button
    - expect: At least one result for 'NARUTO -ナルト-' is shown

#### 3.3. AniList search — empty query clears results

**File:** `tests/admin/manager/anilist-search-clear.spec.ts`

**Steps:**
  1. Navigate to /manager. Type 'naruto' and wait for results. Clear the search box.
    - expect: Search results grid disappears
    - expect: Only the 'Managed Library' section with empty state text remains visible

#### 3.4. Add manga to managed library via 'Add to Library' button

**File:** `tests/admin/manager/add-manga-to-library.spec.ts`

**Steps:**
  1. Navigate to /manager. Search for 'naruto'. Click 'Add to Library' on the first result card ('NARUTO -ナルト-').
    - expect: POST /api/manager/manga is called with the AniList ID of the selected manga
    - expect: HTTP 200 or 201 response is returned
    - expect: The 'Add to Library' button on that card changes state (e.g. grayed out, shows 'Added', or disappears)
    - expect: The manga appears in the 'Managed Library' section below with its title and cover
  2. Confirm the newly added manga entry in the Managed Library shows volume counts and monitoring status
    - expect: A managed manga card/row is shown with title 'NARUTO -ナルト-'
    - expect: Volume missing/downloaded counts are visible
    - expect: A link or button to view the managed manga detail page exists

#### 3.5. Attempting to add the same manga twice does not create a duplicate

**File:** `tests/admin/manager/add-manga-duplicate.spec.ts`

**Steps:**
  1. Navigate to /manager. Ensure 'NARUTO -ナルト-' is already in the managed library (add it if not). Search 'naruto' again.
    - expect: The 'NARUTO -ナルト-' card in search results shows a disabled/already-added state ('Add to Library' button is disabled or not present)

#### 3.6. Manager search — AniList service responds when queried

**File:** `tests/admin/manager/anilist-service-reachable.spec.ts`

**Steps:**
  1. Directly call GET /api/manager/search?q=naruto via browser fetch (or navigate /manager and type in search box)
    - expect: HTTP 200 response
    - expect: Response body is an array of manga objects, each with fields: id (AniList ID), title (romaji/english), coverImage, volumes, status, score

### 4. manager-import-wizard

**Seed:** `tests/seed-admin.spec.ts`

#### 4.1. Import wizard Step 1 loads with source options and empty history

**File:** `tests/admin/import/wizard-step1-loads.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/manager/import
    - expect: Page heading 'Manual Import' is visible
    - expect: 4-step progress indicator shows steps: 1 Source, 2 Review, 3 Confirm, 4 Import
    - expect: Step 1 is highlighted/active
    - expect: Sub-heading 'Choose Import Source' is visible
    - expect: 'Browse Server' button is visible with description 'Select folders from the server filesystem — NAS drives, external storage, or existing collections'
    - expect: 'Upload Files' button is visible with description 'Drag and drop archives or folders from your computer'
    - expect: 'Import History' section is visible with text 'No import history yet.' (empty test env)
  2. Confirm GET /api/import/history is called and returns HTTP 200 with an empty array []
    - expect: Response body is []

#### 4.2. Browse Server option shows filesystem browser

**File:** `tests/admin/import/browse-server-browser.spec.ts`

**Steps:**
  1. Navigate to /manager/import. Click 'Browse Server'.
    - expect: GET /api/import/browse is called and returns HTTP 200
    - expect: The source selection UI is replaced by 'Browse Server Files' heading and a 'Back to options' button
    - expect: Breadcrumb starts at '.test-data' (the allowed root)
    - expect: Directory listing shows a 'manga' folder (0 items) and 'test.db' file (180 KB approx)
  2. Click on the 'manga' folder button
    - expect: GET /api/import/browse?path=...manga is called
    - expect: Breadcrumb updates to '.test-data / manga'
    - expect: Content shows 'This directory is empty' (test env has no manga files)
  3. Click on the '.test-data' breadcrumb link to navigate back up
    - expect: Directory listing returns to the root level showing 'manga' folder and 'test.db'
  4. Click 'Back to options'
    - expect: Filesystem browser is hidden
    - expect: Step 1 source selection ('Browse Server' and 'Upload Files' buttons) is shown again

#### 4.3. Upload Files option shows drag-and-drop area

**File:** `tests/admin/import/upload-files-ui.spec.ts`

**Steps:**
  1. Navigate to /manager/import. Click 'Upload Files'.
    - expect: The source selection UI is replaced by 'Upload Files' heading and a 'Back to options' button
    - expect: A drag-and-drop drop zone is visible with text 'Drag and drop files here'
    - expect: Acceptable formats listed: 'Archives (.zip, .rar, .7z, .cbz, .cbr) or image folders — max 5 GB'
    - expect: 'Choose Files' button is visible
    - expect: 'Choose Folder' button is visible
  2. Click 'Back to options'
    - expect: Drag-and-drop UI is replaced by the original source selection buttons

#### 4.4. Import History section shows empty state

**File:** `tests/admin/import/import-history-empty.spec.ts`

**Steps:**
  1. Navigate to /manager/import
    - expect: 'Import History' section heading is visible
    - expect: Text 'No import history yet.' is displayed below it
    - expect: GET /api/import/history returns HTTP 200 with body []

#### 4.5. Non-admin redirect — import page requires admin role

**File:** `tests/admin/import/non-admin-redirect.spec.ts`

**Steps:**
  1. Using the regular user session (playwright/.auth/regular.json), navigate to /manager/import
    - expect: The user is redirected away from /manager/import to / or /login (page-level admin check enforced)

### 5. system-status

**Seed:** `tests/seed-admin.spec.ts`

#### 5.1. System status page loads with all sections

**File:** `tests/admin/system/status-page-loads.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/system/status
    - expect: Heading 'System Status' is visible
    - expect: 'Refresh' button is visible
    - expect: Services section shows Deluge (Unreachable, ~0ms), Jackett (Unreachable, ~0ms), AniList (Connected, latency value)
    - expect: Background Tasks table shows 'Library Scan' and 'Auto Import' rows, both status 'idle', Last Run 'Never'
    - expect: Storage section shows Manga Library path, disk free space, Database path (~180 KB), and Staging (Empty)
    - expect: Library Statistics show 0 Manga, 0 Volumes, 0 Pages, 0 Managed, 2 Users (1 admin)
    - expect: About section shows version 0.1.0, Node.js version, platform darwin/arm64, environment 'development'
    - expect: 'Clean Up Staging' and 'Vacuum Database' buttons are present in About section
  2. Confirm GET /api/system/status is called and returns HTTP 200 with keys: services, disk, database, tasks, system, health, version
    - expect: All top-level keys are present in the response body

#### 5.2. Service tiles — Deluge and Jackett show Unreachable (stubbed service state)

**File:** `tests/admin/system/service-tiles-stubbed.spec.ts`

**Steps:**
  1. Navigate to /system/status
    - expect: Deluge tile shows status 'Unreachable' with error message containing 'fetch failed'
    - expect: Jackett tile shows status 'Unreachable' with error message containing 'fetch failed'
    - expect: AniList tile shows status 'Connected' with a positive latency reading
    - expect: AniList tile shows Rate limit remaining (e.g. '29 / 30 remaining')
    - expect: Global warning banner or alert text mentions both Deluge and Jackett cannot connect

#### 5.3. Service Test buttons return live results

**File:** `tests/admin/system/service-test-buttons.spec.ts`

**Steps:**
  1. Navigate to /system/status. Click the 'Test' button on the Jackett service tile.
    - expect: GET /api/system/services/jackett/test is called and returns HTTP 200
    - expect: Response body: { name: 'Jackett', status: 'unreachable', message: 'fetch failed', responseTimeMs: 0 }
    - expect: Tile updates to reflect the fresh check result (still Unreachable — expected in test env)
  2. Click the 'Test' button on the Deluge service tile.
    - expect: GET /api/system/services/deluge/test returns HTTP 200
    - expect: Response body: { name: 'Deluge', status: 'unreachable', message: 'fetch failed', responseTimeMs: 0 }
  3. Click the 'Test' button on the AniList service tile.
    - expect: GET /api/system/services/anilist/test returns HTTP 200
    - expect: Response body contains status: 'connected' and a positive responseTimeMs value

#### 5.4. Invalid service name returns 400

**File:** `tests/admin/system/invalid-service-name.spec.ts`

**Steps:**
  1. Send GET /api/system/services/invalid/test via browser fetch
    - expect: HTTP 400 response is returned
    - expect: Response indicates the service name 'invalid' is not recognized

#### 5.5. Background task 'Run Now' buttons trigger tasks

**File:** `tests/admin/system/run-task-now.spec.ts`

**Steps:**
  1. Navigate to /system/status. Locate the 'Library Scan' row. Click 'Run Now'.
    - expect: POST /api/system/tasks/libraryScan/run (or the appropriate task name) is called
    - expect: Row status may briefly change from 'idle' to 'running' then back to 'idle'
    - expect: A success notification or updated 'Last Run' timestamp is shown
    - expect: No 5xx error occurs
  2. Click 'Run Now' on the 'Auto Import' row.
    - expect: POST /api/system/tasks/autoImport/run (or equivalent) is called
    - expect: Status transitions to running then idle
    - expect: No 5xx error occurs

#### 5.6. Refresh button re-fetches system status

**File:** `tests/admin/system/refresh-button.spec.ts`

**Steps:**
  1. Navigate to /system/status. Click the 'Refresh' button.
    - expect: GET /api/system/status is called again
    - expect: Page data is refreshed (uptime counter increases; other stats remain consistent)

#### 5.7. Clean Up Staging action

**File:** `tests/admin/system/cleanup-staging.spec.ts`

**Steps:**
  1. Navigate to /system/status. Click 'Clean Up Staging'.
    - expect: POST /api/system/cleanup/staging is called
    - expect: HTTP 200 response
    - expect: A success notification is shown (or Staging continues to show 'Empty' since no stale sessions exist in test env)

#### 5.8. Vacuum Database action

**File:** `tests/admin/system/vacuum-database.spec.ts`

**Steps:**
  1. Navigate to /system/status. Click 'Vacuum Database'.
    - expect: POST /api/system/database/vacuum is called
    - expect: HTTP 200 response with body containing size before and after (e.g. { before: 184320, after: 184320 })
    - expect: A success notification or updated database size is shown

#### 5.9. Non-admin is redirected from /system/status

**File:** `tests/admin/system/non-admin-redirect.spec.ts`

**Steps:**
  1. Using the regular user session, navigate to /system/status
    - expect: The regular user is redirected to / or another non-admin page (page-level role check enforced)

#### 5.10. System Status accessible via admin user menu

**File:** `tests/admin/system/system-status-via-user-menu.spec.ts`

**Steps:**
  1. Navigate to any page. Click the 'TA' avatar button in the top-right navigation.
    - expect: User menu opens showing: display name 'Test Admin', email 'admin@test.local'
    - expect: Links: 'Account Settings' → /settings/account, 'Admin Panel' → /settings/admin, 'System Status' → /system/status
    - expect: 'System Status' link shows a badge number matching the count of failed services (2 in test env: Jackett + Deluge)
    - expect: 'Sign Out' button is visible
  2. Click 'System Status' in the user menu
    - expect: Navigation goes to /system/status
    - expect: The system status page loads

### 6. admin-apis

**Seed:** `tests/seed-admin.spec.ts`

#### 6.1. GET /api/auth/admin/list-users returns paginated user list

**File:** `tests/admin/apis/list-users-api.spec.ts`

**Steps:**
  1. As admin, send GET /api/auth/admin/list-users?limit=100&offset=0
    - expect: HTTP 200 response
    - expect: Body shape: { users: [...], total: 2, limit: 100 }
    - expect: users[0]: { id, name: 'Test Admin', email: 'admin@test.local', role: 'admin', banned: false, twoFactorEnabled: false }
    - expect: users[1]: { id, name: 'Regular User', email: 'user@test.local', role: 'user', banned: false, twoFactorEnabled: false }

#### 6.2. POST /api/library/scan returns 200 with diff object

**File:** `tests/admin/apis/library-scan-api.spec.ts`

**Steps:**
  1. As admin, send POST /api/library/scan
    - expect: HTTP 200 response
    - expect: Body: { added: 0, updated: 0, removed: 0 } (empty test env fixture)
    - expect: No 5xx error

#### 6.3. GET /api/manager/search?q=naruto proxies AniList and returns results

**File:** `tests/admin/apis/manager-search-api.spec.ts`

**Steps:**
  1. As admin, send GET /api/manager/search?q=naruto
    - expect: HTTP 200 response
    - expect: Body is an array with at least one item
    - expect: Each item has: id (number), title (string), coverImage (string URL), status (string), volumes (number or null)
  2. Send GET /api/manager/search (missing q parameter)
    - expect: HTTP 400 or error response indicating q is required

#### 6.4. GET /api/system/health returns aggregated checks

**File:** `tests/admin/apis/system-health-api.spec.ts`

**Steps:**
  1. As admin, send GET /api/system/health
    - expect: HTTP 200 response
    - expect: Body has keys: 'checks' and 'counts'
    - expect: checks contains entries for deluge, jackett, anilist
    - expect: Deluge and Jackett have status 'unreachable' (stubbed)
    - expect: AniList has status 'connected'

#### 6.5. GET /api/system/status returns comprehensive system info

**File:** `tests/admin/apis/system-status-api.spec.ts`

**Steps:**
  1. As admin, send GET /api/system/status
    - expect: HTTP 200 response
    - expect: Body has keys: services, disk, database, tasks, system, health, version
    - expect: services.deluge.status === 'unreachable'
    - expect: services.jackett.status === 'unreachable'
    - expect: services.anilist.status === 'connected'
    - expect: database contains path pointing to .test-data/test.db
    - expect: system.nodeVersion starts with 'v'
    - expect: version === '0.1.0'
  2. Send GET /api/system/status?force=true
    - expect: HTTP 200 response with same shape — force=true bypasses cache and re-checks services

#### 6.6. GET /api/system/services/{name}/test for each service

**File:** `tests/admin/apis/service-test-api.spec.ts`

**Steps:**
  1. As admin, send GET /api/system/services/jackett/test
    - expect: HTTP 200 response
    - expect: Body: { name: 'Jackett', status: 'unreachable', message: 'fetch failed', responseTimeMs: 0, lastChecked: <ISO timestamp> }
  2. Send GET /api/system/services/deluge/test
    - expect: HTTP 200 response
    - expect: Body: { name: 'Deluge', status: 'unreachable', message: 'fetch failed', responseTimeMs: 0, lastChecked: <ISO timestamp> }
  3. Send GET /api/system/services/anilist/test
    - expect: HTTP 200 response
    - expect: Body has: { name: 'AniList', status: 'connected', responseTimeMs: <positive number>, lastChecked: <ISO timestamp> }
  4. Send GET /api/system/services/invalid/test
    - expect: HTTP 400 response
    - expect: Body indicates the service name is not recognized

#### 6.7. GET /api/import/history returns empty array in clean env

**File:** `tests/admin/apis/import-history-api.spec.ts`

**Steps:**
  1. As admin, send GET /api/import/history
    - expect: HTTP 200 response
    - expect: Body is an empty array []
    - expect: No 5xx error

#### 6.8. GET /api/import/browse returns allowed roots

**File:** `tests/admin/apis/import-browse-api.spec.ts`

**Steps:**
  1. As admin, send GET /api/import/browse
    - expect: HTTP 200 response
    - expect: Body: { currentPath: <path>, entries: [...], breadcrumbs: [...], allowedRoots: [...] }
    - expect: allowedRoots contains entry for the test-data directory
    - expect: entries contains at least 'manga' (directory, childCount: 0) and 'test.db' (file)

#### 6.9. GET /api/user/preferences returns admin's preference keys

**File:** `tests/admin/apis/user-preferences-api.spec.ts`

**Steps:**
  1. As admin, send GET /api/user/preferences
    - expect: HTTP 200 response
    - expect: Body has keys: theme, ocrEnabled, copyStripLinebreaks, textViewButton, ankiSettings
    - expect: No 5xx error

#### 6.10. Admin-only API endpoints return 403 for unauthenticated requests

**File:** `tests/admin/apis/admin-only-403.spec.ts`

**Steps:**
  1. Send POST /api/library/scan without a session cookie (logged-out state)
    - expect: HTTP 401 or redirect to /login (proxy intercepts before handler)
  2. Send GET /api/system/status using the regular user session
    - expect: HTTP 403 response (requireAdmin() rejects non-admin role)
  3. Send GET /api/import/history using the regular user session
    - expect: HTTP 403 response

### 7. shared-with-regular-user

**Seed:** `tests/seed-admin.spec.ts`

#### 7.1. Account Settings page loads all sections for admin

**File:** `tests/admin/shared/account-settings.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/account
    - expect: Heading 'Account Settings' is visible
    - expect: Section 'Theme' with buttons: System, Dark, Chalk, Sakura, AMOLED (Dark is selected by default)
    - expect: Section 'Reader' with toggle 'Japanese OCR overlays'
    - expect: Section 'Text tools' with toggles: 'Strip linebreaks on copy' (checked by default), 'Show text-view button in reader'
    - expect: Section 'AnkiConnect' with URL field (default 'http://127.0.0.1:8765'), 'Test connection' button, deck/note type fields, tags, image format dropdown, JPEG quality slider, crop padding, capture mode, preview dialog toggle, Save and Reset buttons
    - expect: Section 'Dictionaries' with 4 installable dictionaries: Jitendex (JMdict), KANJIDIC2, JPDB Frequency, BCCWJ Frequency, each with an 'Install' button
    - expect: Section 'Profile' with disabled Email field ('admin@test.local'), editable Display Name ('Test Admin'), disabled Save button (until changed)
    - expect: Section 'Change Password' with Current Password, New Password, Confirm New Password fields and 'Change Password' button
    - expect: Section 'Two-Factor Authentication' with password entry and 'Enable 2FA' button (disabled until password entered)
    - expect: Section 'Passkeys' with 'Register New Passkey' button
    - expect: Section 'Active Sessions' with 'Sign out all others' button and list of current sessions with 'Revoke' buttons

#### 7.2. Theme selection persists via /api/user/preferences PUT

**File:** `tests/admin/shared/theme-selection.spec.ts`

**Steps:**
  1. Navigate to /settings/account. Click the 'Chalk' theme button.
    - expect: PUT /api/user/preferences is called with { theme: 'chalk' }
    - expect: HTTP 200 response
    - expect: 'Chalk' button shows selected/active state (highlighted border)
  2. Click the 'Dark' theme button to restore default
    - expect: PUT /api/user/preferences is called with { theme: 'dark' }
    - expect: 'Dark' button shows selected state

#### 7.3. Profile display name update

**File:** `tests/admin/shared/profile-display-name.spec.ts`

**Steps:**
  1. Navigate to /settings/account. Clear the 'Display Name' field and type a new name (e.g. 'Test Admin Updated').
    - expect: 'Save' button becomes enabled
  2. Click 'Save'.
    - expect: An API call updates the display name (PATCH/PUT to user profile endpoint)
    - expect: A success notification is shown
    - expect: Display name in the nav avatar updates to reflect new name
  3. Restore the original name 'Test Admin' and save again.
    - expect: Name restored to 'Test Admin'

#### 7.4. Downloads page shows empty state for admin

**File:** `tests/admin/shared/downloads-empty-state.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/downloads
    - expect: Heading 'Downloads' is visible
    - expect: Empty state icon is shown
    - expect: Text 'No active downloads' is displayed
    - expect: 'Go to Manager' link is visible and points to /manager
  2. Confirm GET /api/downloads/status is called and returns HTTP 200
    - expect: Response body indicates zero active downloads (empty arrays or zero counts)

#### 7.5. Admin navigation bar shows all nav items

**File:** `tests/admin/shared/admin-nav-items.spec.ts`

**Steps:**
  1. Navigate to / as admin
    - expect: Nav contains: logo/home link, 'Library' link (→/), 'Manager' link (→/manager), 'Downloads' link (→/downloads)
    - expect: 'Scan Library' button is visible in the nav (admin-only control)
    - expect: User avatar button 'TA' is visible with a badge number for pending downloads/services

#### 7.6. Admin user menu links are correct

**File:** `tests/admin/shared/admin-user-menu.spec.ts`

**Steps:**
  1. Navigate to /. Click the 'TA' avatar button.
    - expect: User menu shows 'Test Admin' and 'admin@test.local'
    - expect: 'Account Settings' link goes to /settings/account
    - expect: 'Admin Panel' link goes to /settings/admin
    - expect: 'System Status' link goes to /system/status
    - expect: 'Sign Out' button is present

#### 7.7. GET /api/user/preferences returns expected shape for admin

**File:** `tests/admin/shared/user-preferences-shape.spec.ts`

**Steps:**
  1. As admin, send GET /api/user/preferences
    - expect: HTTP 200 response
    - expect: Body.theme is a string (e.g. 'dark')
    - expect: Body.ocrEnabled is a boolean
    - expect: Body.copyStripLinebreaks is a boolean (true by default)
    - expect: Body.textViewButton is a boolean
    - expect: Body.ankiSettings is an object with keys: enabled, url, deck, noteType, sentenceField, imageField, sourceField, definitionField, tags, imageFormat, jpegQuality, cropPadding, captureMode, showPreviewDialog

#### 7.8. OCR overlay toggle persists

**File:** `tests/admin/shared/ocr-overlay-toggle.spec.ts`

**Steps:**
  1. Navigate to /settings/account. Toggle the 'Japanese OCR overlays' switch.
    - expect: PUT /api/user/preferences is called with updated ocrEnabled value
    - expect: HTTP 200 response
    - expect: Switch visual state updates
  2. Toggle it back to original state
    - expect: PUT /api/user/preferences is called again
    - expect: Switch returns to original visual state
