# MangaShelf — Master E2E Flow List

> Master inventory derived from cross-referencing:
> - `specs/discovered/{logged-out,regular-user,admin}/plan.md` (Playwright planner output, 3 auth states)
> - `specs/discovered/admin/manga-reader/*` (reader-populated planner pass against the Yotsuba v01 fixture)
> - `tests/ROUTES.md` (route-scout inventory: 14 pages + 43 API files / 49 handlers)
> - `audit/modularity.md` (god files, scattered domain logic, refactor priority)
> - `audit/boundaries.md` (cross-domain reach-throughs, server-only leak risk)
>
> No `.spec.ts` files written from this document yet. Plans live under `specs/discovered/`. Use this as the spec-implementation backlog.

---

## 1. Confirmed user-facing flows (ready to spec)

Routes the planner **reached** AND that exist in code. Grouped by feature, deduplicated across passes.

### 1.1 Authentication & onboarding
| Route(s) | Auth pass(es) | Flow / spec hook |
|----------|---------------|------------------|
| `/login` page | logged-out | Form render, passkey button (conditional on `PublicKeyCredential`), loading spinner before `setup-status` resolves, redirect to `/setup` when `needsSetup:true`, wrong-credentials error (`401`, "Invalid email or password"), browser-required-field validation, stubbed 2FA TOTP screen + 6-digit gating |
| `/setup` page | logged-out | Form render, password-mismatch inline error, short-password (<8) inline error, required-field validation, redirect to `/login` when users exist |
| `/api/auth/setup-status` GET | logged-out | `{needsSetup:true|false}` truth table against user count |
| `/api/auth/sign-in/email` POST | logged-out | `401` on bad creds; happy path covered indirectly by `tests/auth.setup.ts` seed |
| `/api/auth/get-session` GET | logged-out | Returns `null` when no cookie |
| `/api/auth/admin/list-users` GET | admin | Paginated list, role/banned/twoFactorEnabled fields |
| `/api/auth/admin/create-user` POST | admin | Throwaway create + delete, role dropdown ("User"/"Admin"), validation (empty / bad email) |

### 1.2 Authed redirect / role gating
| Route(s) | Auth pass(es) | Flow / spec hook |
|----------|---------------|------------------|
| `/login`, `/setup` (authed) | regular-user, (admin implied) | Redirect to `/` |
| `/`, `/manager`, `/downloads`, `/manga/[id]`, `/settings/account`, `/settings/admin` (unauthed) | logged-out | Proxy redirect to `/login` (users exist) or `/setup` (none) |
| `/settings/admin`, `/manager/import`, `/system/status` (regular-user) | regular-user | Page-level role check → redirect to `/` (not `/login`, contrary to ROUTES.md hint for `/manager/import`) |

### 1.3 Library / Reader landing
| Route(s) | Auth pass(es) | Flow / spec hook |
|----------|---------------|------------------|
| `/` page | admin, regular-user | Empty state ("No manga found.", "Place manga folders in your MANGA_DIR and click Scan Library."), search-box filter, sort dropdown (Title / Recently Read / Recently Added), `Select` button (admin only), `Scan Library` button (admin only), logo link back to `/`, `Library` nav-link active class |
| `/manga/999999` page | regular-user | 404 page render |
| `/manga/999999/read/1` page | regular-user | 404 page render |
| `/manga/999999` (manager) | regular-user | 404 page render |
| `/api/manga` GET (orphan) | regular-user | `200 []` on empty library |

### 1.4 Account settings (`/settings/account`)
| Section | Auth pass(es) | Flow / spec hook |
|---------|---------------|------------------|
| Theme | regular-user, admin | Click each of `System / Dark / Chalk / Sakura / AMOLED` → `PUT /api/user/preferences` |
| Reader → OCR overlay switch | regular-user, admin | Toggle persists |
| Text tools → Strip linebreaks + Show text-view button | regular-user, admin | Default state, toggle persistence |
| AnkiConnect | regular-user, admin | URL field default `http://127.0.0.1:8765`, deck default `Mining`, test-connection button, Save button enabled on change |
| Dictionaries | regular-user, admin | 4 dictionaries (Jitendex, KANJIDIC2, JPDB Frequency, BCCWJ Frequency) each w/ Install button |
| Profile | regular-user, admin | Email disabled, Display Name editable, Save disabled until change |
| Change Password | regular-user, admin | Wrong-current-password → "Invalid password" inline; observed side effect: session invalidation forces re-login |
| Two-Factor Authentication | regular-user, admin | `Enable 2FA` disabled until password typed |
| Passkeys | regular-user, admin | `Register New Passkey` button present |
| Active Sessions | regular-user, admin | Current session listed with today date prefix |
| `/api/user/preferences` GET/PUT | regular-user, admin | Shape check (`theme`, `ocrEnabled`, `copyStripLinebreaks`, `textViewButton`, `ankiSettings.*`), single-key PUT update |

### 1.5 User menu / nav
| Surface | Auth pass(es) | Flow / spec hook |
|---------|---------------|------------------|
| `Nav` for regular user | regular-user | Only `Library` link; no Manager/Downloads/Scan-Library |
| `Nav` for admin | admin | Logo + Library + Manager + Downloads + Scan-Library button + service-status badge |
| User menu for regular user (`RU`) | regular-user | Account Settings + Sign Out only; no Admin Panel / System Status / health badge |
| User menu for admin (`TA`) | admin | Account Settings + Admin Panel + System Status (+ failing-service badge "2") + Sign Out |

### 1.6 Manager (`/manager` + `/manager/[id]`)
| Route(s) | Auth pass(es) | Flow / spec hook |
|----------|---------------|------------------|
| `/manager` page | admin, regular-user | Empty state "No manga added yet.", AniList search box, Manual Import link |
| `/api/manager/search?q=…` GET | admin (200, AniList proxy), regular-user (403) | Debounced query, results grid w/ score/title/volumes/status/Add-to-Library |
| `/api/manager/manga` POST | admin (200/201 add), regular-user (403) | Add by `anilistId` |
| `/manager/import` page | admin | Wizard Step 1: 4-step indicator, Browse Server + Upload Files buttons, Import History section |
| `/api/import/history` GET | admin (`[]` empty env), regular-user (`403 {"error":"Unauthorized"}` — note divergent body) | History list |
| `/api/import/browse` GET | admin (entries / breadcrumbs / allowedRoots), regular-user (`403 {"error":"Unauthorized"}`) | Path nav including `..` traversal guard |

### 1.7 Downloads
| Route(s) | Auth pass(es) | Flow / spec hook |
|----------|---------------|------------------|
| `/downloads` page | admin, regular-user | Empty state "No active downloads", Go-to-Manager link |
| `/api/downloads/status` GET | admin, regular-user | `200`, body shape `{active, bulk, recent, importing, scanning, hasActiveDownloads, summary{activeCount,bulkCount,recentCount}}` |

### 1.8 Admin: User Management (`/settings/admin`)
| Surface | Flow / spec hook |
|---------|------------------|
| Panel load | "2 users", search box, Create User button, row-level role badge |
| Email search filter | Live narrow, "0 users" on miss |
| Create User form | Required validation, role dropdown, throwaway create increments count |
| User row action menu — regular user | Promote/Ban/Revoke/Delete (no Demote) |
| User row action menu — admin user | Demote/Ban/Revoke/Delete (no Promote) |
| Promote ↔ Demote | Role badge flips both ways |
| Ban + Revoke Sessions | Action fires, throwaway cleanup |
| Create-then-delete cycle | Count returns to baseline |

### 1.9 Admin: System Status (`/system/status`)
| Surface | Flow / spec hook |
|---------|------------------|
| Page load | Heading, Refresh, Services tiles (Deluge/Jackett stubbed `Unreachable`, AniList `Connected`), Background Tasks, Storage, Library Stats, About |
| Service tiles | Stubbed-service branch (Deluge/Jackett `fetch failed`) and live AniList path |
| `Test` buttons | `/api/system/services/{deluge,jackett,anilist,invalid}/test` |
| Background-task Run-Now | `POST /api/system/tasks/{libraryScan,autoImport}/run` |
| Refresh | Re-fetch `GET /api/system/status` |
| Clean Up Staging | `POST /api/system/cleanup/staging` |
| Vacuum Database | `POST /api/system/database/vacuum` returns `{before, after}` |
| `GET /api/system/health` | Aggregated `{checks, counts}` |
| `GET /api/system/status?force=true` | Bypass cache |
| Reach via admin user menu | `System Status` link + failing-service badge |

### 1.10 Admin: Library scan
| Route(s) | Flow / spec hook |
|----------|------------------|
| `POST /api/library/scan` | Admin: `{added:0,updated:0,removed:0}` on empty MANGA_DIR. Regular user: `403`. |

### 1.11 Reader (populated library) — discovered by `specs/discovered/admin/manga-reader/`
Requires the Yotsuba v01 fixture (see §5). Each flow has its own plan file.

| Flow | Plan file | Routes hit | Spec hook |
|------|-----------|-----------|-----------|
| Open manga from home | `flow-1-open-manga-from-home.md` | `/`, `/manga/1` | Library grid card click → detail page; cover + title + volume list visible; URL change. |
| Open volume to read | `flow-2-open-volume-to-read.md` | `/manga/1`, `/manga/1/read/1` | Two entry points: `Start Reading · Vol 1` CTA + volume card. Label flips to `Read Vol 1` once any progress row exists. Back-link is the manga-title button (`Yotsuba to!`). |
| Scroll the reader | `flow-3-scroll-reader.md` | `/manga/1/read/1`, `GET /api/manga/1/volume/1/page/<N>`, `PUT /api/progress/1/1` | Sliding window of ~6 mounted `<img>` per scroll position; all 20 outer slots exist in DOM from initial render. Progress writes `{currentPage: N}` 0-indexed. Failure-to-load probed by `browser_route` 404-stub. |
| OCR overlay (multi-step) | `flow-4-ocr-overlay.md` | `/settings/account`, `PUT /api/user/preferences`, `/manga/1/read/1`, `GET /api/manga/1/volume/1/ocr` | Settings toggle label `Japanese OCR overlays` vs in-reader button label `OCR` (tooltip flips `Show OCR text` ↔ `Hide OCR text`). Overlay nodes unmount when toggle off. Global OFF → in-reader button absent. Page 13 (index 12) has 4 OCR blocks. |

Findings + UI inconsistencies captured in `specs/discovered/admin/manga-reader/SUMMARY.md`.

---

## 2. Routes in code, NOT reached by planner

### 2.A Role-locked
> Already verified as gated by the planner's role redirects. Listed here only if there is no representative coverage in section 1.

None remaining. Every admin-only page and admin-only API was at least probed for `403` from the regular-user pass or successfully exercised in the admin pass.

### 2.B Requires specific data state (populated library, in-flight import, AniList match)

Spec-able only after seeding fixtures.

#### Reader, populated library
> Items moved up to §1.11 once planned: `/manga/[id]`, `/manga/[id]/read/[volumeNumber]`, `GET /api/manga/[id]/volume/[volumeNumber]/page/[pageNumber]`, `PUT /api/progress/[mangaId]/[volumeId]`, `GET /api/manga/[id]/volume/[volumeNumber]/ocr`, `GET /api/covers/[anilistId]`.

Still unplanned (need extra fixtures or fixture variants):
- `/manga/[id]/text` page — OCR text across **all** volumes via `loadMokuroFile`. Needs ≥2 volumes with `.mokuro`. Current fixture has v01 only.
- `/manga/[id]/volume/[volumeNumber]/text` page — single-volume OCR text view. Reachable with current fixture but not yet planned.
- `GET /api/manga/[id]/ocr`, `POST /api/manga/[id]/ocr` — summary + enqueue. Enqueue path needs the OCR dispatcher live; currently short-circuited by `E2E=1` in `src/instrumentation.ts`.
- `GET /api/manga/[id]` (**orphan**) — single manga + volumes + progress.
- `GET /api/manga/[id]/volume/[volumeNumber]/pages` (**orphan**) — page listing.
- `GET /api/progress/[mangaId]` (**orphan**) — all progress rows.
- `POST /api/anki/capture` — `sharp`-cropped page region. Needs Anki preview spec.

**Audit hot-spot still relevant:** `src/app/manga/[id]/page.tsx` is 357 lines and queries Manager tables (boundary §3a/§4 rank #4).

#### Manager, populated managed library
- `/manager/[id]` page — populated render: hero + volume list + monitoring controls + download history + bulk-download tracking. **Audit hot-spot:** `src/components/manager/manga-detail.tsx` is 512 lines (modularity §2).
- `GET /api/manager/manga` (**orphan**) — full list with derived counts.
- `GET /api/manager/manga/[id]` (**orphan**).
- `PUT /api/manager/manga/[id]` — `monitored` toggle.
- `DELETE /api/manager/manga/[id]` (**orphan** — UI uses `/api/delete`).
- `POST /api/manager/manga/[id]/search` — Jackett search.
- `POST /api/manager/manga/[id]/download` — magnet → Deluge.
- `POST /api/manager/manga/[id]/monitor` — `monitorSingleManga`.
- `POST /api/manager/monitor/run` — `refreshReleasingManga` + `runMonitoringCycle`.
- `GET /api/manager/anilist/[anilistId]` (**orphan**) — passthrough.
- `POST /api/delete` — cross-domain delete, optional `deleteFiles`. **Audit hot-spot:** boundary §3b — sits in Reader namespace.

#### Import wizard, mid-flight
- `POST /api/import/analyze` — analyze a server path / uploaded session. **Audit hot-spot:** 356-line route with embedded business logic (modularity §2).
- `POST /api/import/execute` — kicks off the run. **Audit hot-spot:** the 411-line `progress/[importId]` route is its execution engine (modularity §2 + priority #2).
- `GET /api/import/progress/[importId]` — SSE-style polling stream.
- `DELETE /api/import/session/[sessionId]` — cancel session.
- `POST /api/import/upload/init` — allocate upload session id.
- `POST /api/import/upload` — multipart streaming upload. **Audit hot-spot:** 224 lines, hand-rolled multipart parser.
- `GET /api/import/upload/progress/[sessionId]` — `{status, bytesReceived, bytesTotal}`.
- `GET /api/import/preview/[sessionId]/[volumeIndex]/[pageIndex]` — `sharp` thumbnail.

#### Misc data-required
- `POST /api/dict/install` — needs a dictionary URL from the catalog UI.
- `POST /api/manager/import` (**orphan**) — manual import trigger (UI uses `/api/manager/monitor/run`).
- `GET /api/manager/downloads` (**orphan**) — recent `downloadHistory` join.

### 2.C Orphans (refactor cleanup flag, not test priority)

ROUTES.md confirms 9 orphan handlers. **None are reached by any UI** because the corresponding page reads the DB directly server-side. Listed for the dead-code pass, not the spec backlog:

1. `GET /api/manga`
2. `GET /api/manga/[id]`
3. `GET /api/manga/[id]/volume/[volumeNumber]/pages`
4. `GET /api/progress/[mangaId]`
5. `GET /api/manager/anilist/[anilistId]`
6. `GET /api/manager/downloads`
7. `POST /api/manager/import`
8. `GET /api/manager/manga`
9. `GET /api/manager/manga/[id]` + `DELETE /api/manager/manga/[id]`

If the goal is "test only what users hit," skip spec for these. If the goal is "exercise the surface as a contract", keep a single happy-path test per orphan and ticket the removal.

---

## 3. Top 5 critical flows to spec first

Priority signal weights:
- **B** = crosses server↔client or Reader↔Manager boundary (`audit/boundaries.md` §3, §4)
- **M** = touches a god file / scattered domain concept (`audit/modularity.md` §2, §6, §9)
- **R** = reachability gate (a fixture other flows depend on)

Status legend: 📋 plan drafted • ⚙️ `.spec.ts` pending • (when a flow has both, it means converting the plan to executable specs is the next step).

| # | Flow | Routes | Signal | Status | One-line rationale |
|---|------|--------|--------|--------|--------------------|
| 1 | **Library → Manga detail → Reader (populated)** | `/`, `/manga/[id]`, `/manga/[id]/read/[volumeNumber]`, `/api/manga/[id]/volume/[volumeNumber]/page/[pageNumber]`, `PUT /api/progress/[mangaId]/[volumeId]` | B + M + R | 📋 + ⚙️ | Reader pages (`src/app/page.tsx`, `src/app/manga/[id]/page.tsx`) query Manager-domain tables directly (`boundaries.md` §3a / rank 3-4); fixture seeded. Plans 1–3 in `specs/discovered/admin/manga-reader/`. Convert to `.spec.ts` first — high signal, fixture ready. |
| 2 | **Manual import wizard end-to-end (server browse + upload)** | `/manager/import` → `POST /api/import/analyze` → `POST /api/import/execute` → `GET /api/import/progress/[importId]` → library appears at `/` | M | ⚙️ | The `progress/[importId]` route is 411 lines and is the import execution engine inline (`modularity.md` priority #2). Highest blast radius — a regression here corrupts the library. Specs must cover Browse-Server, Upload-Files (multipart streaming + `init`/`upload`/`progress`/`session` lifecycle), and replace-existing-volume paths plus the SSE event stream. **Bumped up** from #3: file-handling is the largest untested surface. |
| 3 | **Manager: search → add → manga detail → bulk download** | `/manager`, `POST /api/manager/manga`, `/manager/[id]`, `POST /api/manager/manga/[id]/search`, `POST /api/manager/manga/[id]/download`, `GET /api/downloads/status` | M + B | ⚙️ | Drives `src/lib/importer.ts` lines 740-1409 (the download lifecycle `modularity.md` priority #1 says should be split to `src/lib/download/`) and `src/components/manager/manga-detail.tsx` (512-line god component). Also crosses the Reader↔Manager boundary in `/api/downloads/status`. |
| 4 | **OCR overlay across the global ↔ in-reader controls** | `/settings/account`, `PUT /api/user/preferences`, `/manga/[id]/read/[volumeNumber]`, `GET /api/manga/[id]/volume/[volumeNumber]/ocr` | M | 📋 + ⚙️ | Two label-mismatched controls (`Japanese OCR overlays` vs `OCR`), state-machine across pages with/without OCR blocks, overlay unmount semantics. Plan 4 in `specs/discovered/admin/manga-reader/`. Spec must lock both labels verbatim so a rename in one place fails the assertion on the other. **Replaces** the previous #4 ("Reading progress write path") which is now subsumed by #1's flow-3 plan. |
| 5 | **`/settings/account` god-component sections (2FA + passkey + sessions + password change)** | `/settings/account`, `POST /api/auth/two-factor/*`, `POST /api/auth/passkey/*`, `DELETE /api/auth/sessions/*` | M | ⚙️ | `src/components/auth/account-settings.tsx` is 645 lines with 23 hooks (`modularity.md` §3 / priority #6). Planner already observed the password-change side effect that invalidates the active session — a regression here logs everyone out. Each sub-section is an independent state machine and deserves its own spec file. |

**Changes since last ranking:**
- Old #1 (Library→Reader populated) now has plans drafted (📋); status flipped to "convert to .spec.ts".
- Old #3 (Manual import wizard) → moved **up** to #2 because the upload + analyze + execute surface is the largest unplanned chunk and the highest-blast-radius single route in the codebase.
- Old #4 (Reading progress write path) → **dropped** from top 5; now covered by Flow-3 of the new reader plans.
- New #4 (OCR overlay) → added because it surfaces a UI inconsistency (label mismatch between two controls) and exercises the OCR overlay state machine in the reader.

---

## 4. Open issues surfaced by the discovery passes

Carried items from the original three planner runs (logged-out, regular-user, admin) plus new finds from the reader pass. These are triage candidates, not spec items.

- **Hydration mismatch** on `/login` (passkey button SSR-vs-client divergence). Logged-out plan §1.2.
- **Proxy / setup-status disagreement** under test env (proxy sees 0 users, API sees ≥1). Logged-out plan §1.1 overview. Likely WAL-mode SQLite read consistency across the persistent dev-server connection and Playwright global-setup re-init.
- **Inconsistent admin-403 body** — `/api/import/{history,browse}` return `{"error":"Unauthorized"}` while all other admin routes return `{"error":"Forbidden"}`. Regular-user plan §6.14-15.
- **Silent failure on `/manager` AniList search for regular user** — `403` returns nothing; no toast. Regular-user plan §3.2.
- **Password-change session invalidation on wrong current password** — Better-Auth side effect that hard-logs-out the user mid-form. Regular-user plan §7.5. Reader pass independently observed the same invalidation during the OCR flow (twice).
- **OCR label mismatch** — settings says `Japanese OCR overlays`, reader button says `OCR`. Two controls, two names, one feature. Reader SUMMARY.md.
- **In-reader OCR default state non-obvious** — global toggle ON does not immediately render overlays; a second click on the in-reader `OCR` button is required. Reader SUMMARY.md.

---

## 5. Fixture dependencies

Each flow either runs against the seeded fixture or needs additional content. `tests/auth.setup.ts` provisions the fixture every run; missing pieces below need to be added before their flow can be planned.

| Flow | Required fixture | Currently provisioned? |
|------|------------------|------------------------|
| Auth + onboarding (§1.1) | None (works against empty DB) | n/a |
| Library / Reader landing — empty state (§1.3) | Empty `manga` table | Needs ability to run with `tests/auth.setup.ts` skipping the scan + manage steps. Add an env-flag variant or a second setup spec. |
| Library / Reader landing — populated (§1.3, §1.11) | ≥1 manga w/ ≥1 volume | ✅ Yotsuba v01 (`tests/fixtures/manga/Yotsuba to! [anilist-30104]/v01`, 20 pages) |
| Account settings (§1.4) | None | n/a |
| Manager — empty (§1.6) | Empty `managed_manga` table | Same caveat as empty-library above. |
| Manager — populated detail (§1.6, §2.B Manager) | ≥1 `managed_manga` row + matching `manga` | ✅ AniList 30104 row + `.covers/30104.jpg` |
| Manager — search & add (§1.6) | None client-side; AniList live | AniList GraphQL hit during setup; unstubbed. |
| Manager — bulk download (Top 5 #3) | `managed_manga` row + Jackett + Deluge | ❌ Jackett + Deluge stubbed to `127.0.0.1:1`. Need either real services or stubbed HTTP responses via `browser_route` interception. |
| Manual import wizard (Top 5 #2) | Source files on disk (Browse Server) **or** upload payload | Browse-Server roots include `.test-data/manga`. Upload path needs an in-test multipart body (use a small ZIP fixture under `tests/fixtures/uploads/`). **Not yet created.** |
| Reader populated — open / volume / scroll (§1.11 flows 1-3) | ≥1 volume w/ ≥1 page image | ✅ v01 with 20 pages |
| Reader OCR overlay (§1.11 flow 4) | `.mokuro` JSON sibling with ≥1 page containing `blocks: [...]` | ✅ `v01.mokuro` with 20 pages (page 13 has 4 blocks) |
| Multi-volume OCR text view (`/manga/[id]/text`) | ≥2 volumes w/ `.mokuro` | ❌ v01 only. Add v02 + `v02.mokuro` if specing this. |
| Single-volume OCR text view (`/manga/[id]/volume/[volumeNumber]/text`) | 1 volume w/ `.mokuro` | ✅ v01 |
| OCR enqueue (`POST /api/manga/[id]/ocr`) | Mokuro worker reachable | ❌ `MOKURO_URL` unstubbed; `E2E=1` short-circuits the dispatcher in `src/instrumentation.ts`. Either drop the short-circuit or stub the worker HTTP. |
| Anki capture (`POST /api/anki/capture`) | 1 page image + AnkiConnect URL | Page image fixture ✅; AnkiConnect not running. Use `browser_route` to stub `http://127.0.0.1:8765`. |
| Cover route (`GET /api/covers/[anilistId]`) | Matching `managed_manga` row + cached `.covers/<id>.jpg` | ✅ For anilist 30104. Empty-cache branch needs deleting `.covers/30104.jpg` before the test. |

**Fixture maintenance:** see `tests/fixtures/README.md`. New fixtures go under `tests/fixtures/manga/<title>/v<NN>/` with a sibling `v<NN>.mokuro`; `.covers/<anilistId>.jpg` for pre-warmed covers; future upload fixtures under `tests/fixtures/uploads/`.
