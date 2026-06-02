# Plan: Port MangaShelf reader to Mudita Kompakt (native Android e-ink)

## Context

MangaShelf is a self-hosted Next.js manga reader + manager. The user wants to read on a Mudita Kompakt (Android-based e-ink phone) but the existing app is a web app that doesn't fit an e-ink, intermittently-connected, low-power device. Three porting paths were considered:

- **WebView wrapper** — fastest to ship, but Tailwind v4 / OKLCH / React 19 rendering on e-ink is poor (animations, anti-aliased text, no offline reads, no native UX); rejected.
- **Standalone fork** — duplicates the importer / scanner / Jackett/Deluge stack on Android with no shared backend; massive maintenance burden, rejected.
- **Native client against same backend (chosen)** — small Kotlin/Compose app talks to the existing self-hosted server via a new versioned API surface. Server stays the single source of truth for the library; device caches the volumes the user pins for offline reading.

Decisions locked in (see "Decisions" below): reader-only, sync-for-offline, Mudita Kompakt only, MMD design library, single-repo `/android/` subfolder, static API token auth, CBZ-per-volume download, ~12–18 small atomic PRs.

The end-state outcome: user pins a few volumes on the web UI or on the device, takes the Kompakt out, reads offline; progress and library deltas reconcile last-write-wins when the device comes back to the network.

## Decisions (locked in this session)

| Topic | Choice |
|---|---|
| Feature scope v1 | **Expanded (2026-05-29)** → Reader+OCR, Flashcards, and (gated) Dictionary bundle in one app. Manager stays web-only. See "Extension" section at the end of this doc. |
| Connectivity | Sync-for-offline. Pinned volumes cached on device as CBZ. |
| Target device | Mudita Kompakt only (MMD design library, MuditaOS conventions). |
| Repo layout | Same repo, new `/android/` subfolder (Kotlin/Gradle alongside the Next.js app). |
| Auth | Static API token generated in the web UI, `Authorization: Bearer mst_<hex>` on device. |
| Volume download format | CBZ/ZIP per volume, streamed from a new endpoint. |
| Session size | Small atomic — many short reviewable PRs. |

## Stack assessment

**Server side — small lift.** The existing reader API is close to what a native client needs. Schema is already multi-user (`readingProgress.userId`), auth is `better-auth` session-cookie, progress is already last-write-wins with `updatedAt`/`lastReadAt` timestamps. Missing: bearer-token auth path, CBZ archive endpoint, bulk progress sync, library delta query. `fflate` and `adm-zip` are already in `package.json` so the archive endpoint needs no new dependency.

**Android side — medium lift.** Reference apps (CalmMusic, KompaktCalendar) prove the stack: Kotlin + Jetpack Compose, `com.mudita:MMD:1.0.0`, Compose BOM ~2024.06, Material3 1.3.x, minSdk 28, compileSdk 35, JDK 17. KompaktCalendar's "no ripple, no animations, jump scroll, black-on-white" pattern is the playbook. Standard Room + Retrofit + WorkManager + Hilt fit cleanly.

**Real unknowns (must resolve early).** Kompakt input model (touch / D-pad / hardware buttons), exact screen px, available MMD component inventory, whether the OS exposes an e-ink refresh API. Phase 0 includes a research-only session to answer these against MuditaOS public repos.

**Overall difficulty: medium.** No exotic tech, no protocol invention. The bulk of the work is the offline-sync state machine (downloads + progress) and e-ink polish on real hardware. Expect ~12–18 sessions, with a follow-up bug-fix loop after the first time the user holds it in their hand.

## Repo structure

```
mangashelf/                          (existing Next.js app — unchanged at root)
├── src/                             (existing)
├── android/                         NEW
│   ├── settings.gradle.kts
│   ├── build.gradle.kts
│   ├── gradle/libs.versions.toml
│   ├── docs/device.md               Kompakt research notes
│   └── app/
│       ├── build.gradle.kts
│       └── src/main/java/com/mangashelf/reader/
│           ├── MangaShelfApp.kt     Application (Hilt)
│           ├── MainActivity.kt      single-activity host, hardware key handling
│           ├── di/                  NetworkModule, DatabaseModule, RepoModule, WorkModule
│           ├── data/
│           │   ├── local/           Room: AppDatabase, DAOs, entities
│           │   ├── remote/          Retrofit: MangaShelfApi, DTOs, AuthInterceptor
│           │   ├── repo/            LibraryRepository, ProgressRepository, DownloadRepository
│           │   └── store/           TokenStore (EncryptedSharedPreferences), SettingsStore (DataStore)
│           ├── domain/              plain Kotlin models + DTO↔entity mappers
│           ├── sync/                WorkManager workers
│           └── ui/
│               ├── theme/           MangaShelfTheme wraps ThemeMMD
│               ├── common/          shared composables (EmptyState, ErrorState, TopBar wrapper)
│               ├── nav/             NavGraph + routes
│               ├── onboarding/      OnboardingScreen + ViewModel
│               ├── library/         LibraryScreen + ViewModel
│               ├── manga/           MangaDetailScreen + ViewModel
│               ├── reader/          ReaderScreen, PageRenderer, ReaderViewModel
│               ├── downloads/       DownloadsScreen + ViewModel
│               └── settings/        SettingsScreen + ViewModel
└── .github/workflows/               existing + new android job, path-filtered
```

Single `:app` Gradle module — resist multi-module until pain is real. CI is path-filtered: a PR touching only `/android/**` skips the Next.js job and vice-versa (wire this in Phase 6). `.gitignore` adds `/android/{.gradle,build,local.properties,.idea,*.iml,captures}/` and `/android/app/build/`.

## Server changes (grouped)

All new endpoints live under `src/app/api/v1/` to namespace native-client surface. Existing cookie-authed routes are untouched.

**Schema addition** (`src/db/schema.ts` + new migration):

```ts
export const apiToken = sqliteTable("api_token", {
  id: text("id").primaryKey(),                       // uuid
  userId: text("user_id").notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),                      // user label e.g. "Kompakt"
  tokenHash: text("token_hash").notNull().unique(),  // sha256 of plaintext
  prefix: text("prefix").notNull(),                  // first 8 chars for display
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull().default(sql`(unixepoch())`),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
});
```

Plaintext token format: `mst_<32 hex>`. Returned exactly once on create.

**New helper** `src/lib/api-auth.ts` exporting `getSessionFromRequest(req)`: tries `Authorization: Bearer mst_...` → falls back to existing `getSession()` (cookie). All `/api/v1/*` routes use it; legacy routes unchanged.

**New endpoints** (under `src/app/api/v1/`):

| Route | Method | Purpose |
|---|---|---|
| `/auth/tokens` | GET | list current user's tokens (no plaintext) |
| `/auth/tokens` | POST | `{name}` → `{id, token}` (plaintext once) |
| `/auth/tokens/[id]` | DELETE | revoke |
| `/auth/whoami` | GET | `{userId, name, email}` — used by device onboarding |
| `/library` | GET | `?changedSince=<unixSec>` → manga+volumes+`serverTime`; omit unchanged when param set |
| `/manga/[id]/cover` | GET | `?size=sm\|md` → bytes + strong ETag |
| `/manga/[id]/volume/[volumeNumber]/archive` | GET | streams `application/zip` (CBZ); ETag = `vol-${id}-${pageCount}-${maxMtime}` |
| `/progress` | GET | `?changedSince=<unixSec>` → progress rows newer than t |
| `/progress/batch` | POST | `{entries:[{mangaId, volumeId, currentPage, isCompleted, clientUpdatedAt}]}` → `{accepted, rejected}`; LWW by `clientUpdatedAt` vs stored `updatedAt` |

**Web UI addition**: a token-management page under settings (create, copy-once, list, revoke).

**Reuse**:
- `src/lib/scanner.ts` — no change; scanner stays authoritative for filesystem→DB.
- `src/lib/auth.ts` — no change; bearer middleware is additive.
- `src/lib/cover-cache.ts` / `sharp` — reuse for the new cover endpoint.
- `fflate` (already in deps) — use for streaming CBZ generation; `adm-zip` is a fallback.

## Android client architecture

**Screens (all Compose + MMD-themed):**

| Screen | MMD components | Purpose |
|---|---|---|
| Onboarding | `TopBarMMD`, text fields, `ButtonMMD` | Server URL + token, validate via `/whoami`, persist to `TokenStore` |
| Library | `LazyColumnMMD` of rows (cover thumb + title + progress) | Browse manga; tap → MangaDetail |
| MangaDetail | `TopBarMMD` + `LazyColumnMMD` of volumes with status pill + pin toggle | Per-volume state (not downloaded / downloading / on device / read) |
| Reader | Custom full-screen Image + tap zones + MMD top bar on tap-center | Read pages; left/right thirds advance; volume keys also advance |
| Downloads | `LazyColumnMMD` with per-row progress + cancel/retry | Active/queued/failed downloads |
| Settings | MMD list rows | Server URL, sync now, clear cache, revoke token, about |

**Data layer:**
- **Room v1** — `manga`, `volume`, `progress`, `download_queue` entities; `(mangaId, volumeNumber)` is the natural key for client identity (server IDs can churn when a manga folder is removed and re-added). `progress` carries `clientUpdatedAt` and nullable `syncedUpdatedAt`.
- **Retrofit + OkHttp + `AuthInterceptor`** that reads `TokenStore` (EncryptedSharedPreferences). Archive endpoint uses `@Streaming ResponseBody`, written to `filesDir/archives/<mangaId>/v<n>.cbz`.
- **WorkManager**:
  - `LibraryDeltaWorker` — periodic 6h + on-foreground; calls `/v1/library?changedSince=…` and `/v1/progress?changedSince=…`.
  - `DownloadVolumeWorker` — unique work per volume, expedited when user-pinned, `CONNECTED` constraint.
  - `SyncProgressWorker` — debounced 5s after `ProgressRepository.recordRead()`, batched POST to `/v1/progress/batch`, exponential backoff on failure.

**Offline-first read flow:**
1. ViewModel asks `VolumeRepository.openVolume(volumeId)`.
2. If CBZ on disk, decode lazily via `ZipFile` + `BitmapFactory` with `inSampleSize` tuned to display width; 3-bitmap `LruCache` (prev/curr/next).
3. Page turn → `progressRepository.recordRead(volumeId, page, now)` writes Room row with `clientUpdatedAt=now`, `syncedUpdatedAt=null`; enqueues `SyncProgressWorker`.
4. Worker posts batch; success → patch rows with returned `serverUpdatedAt`; `rejected: stale` → clear dirty flag without retry.
5. Pull side: any incoming row with `serverUpdatedAt > local.clientUpdatedAt` overwrites local.

**MMD theme:** `ui/theme/MangaShelfTheme.kt` wraps `ThemeMMD`, exposes pure black/white + one mid-grey; ripple and motion disabled following the KompaktCalendar pattern.

## Ordered Claude Code sessions

### Phase 0 — Foundations

**0.1 Add API token schema + bearer auth helper** (S)
- Scope: `apiToken` table + migration; `src/lib/api-auth.ts` with `getSessionFromRequest`; unit tests for header parsing and hash compare. No routes yet.
- Touches: `src/db/schema.ts`, `drizzle/*`, `src/lib/api-auth.ts`, `src/lib/api-auth.test.ts`
- Deps: none
- Acceptance: migration applies; helper validates a known token row, rejects bad/revoked; existing cookie auth untouched.

**0.2 Token management UI + endpoints** (M)
- Scope: `GET/POST /api/v1/auth/tokens`, `DELETE /api/v1/auth/tokens/[id]`, `GET /api/v1/auth/whoami`; settings page to create+copy-once+revoke.
- Touches: `src/app/api/v1/auth/**`, `src/app/(authenticated)/settings/tokens/page.tsx`
- Deps: 0.1
- Acceptance: `curl -H "Authorization: Bearer mst_…" /api/v1/auth/whoami` returns user; revoked token returns 401.

**0.3 Scaffold `/android/` Gradle project** (M)
- Scope: empty `:app` module with MMD, Compose BOM, Hilt, Room, Retrofit, WorkManager, coroutines. App launches an empty `ThemeMMD` Surface.
- Touches: `/android/**`, `.gitignore`
- Deps: none (runs parallel with 0.1/0.2)
- Acceptance: `./gradlew :app:assembleDebug` succeeds on JDK 17; APK installs on emulator API 28; splash renders.

**0.4 Document Kompakt device specs** (S)
- Scope: research-only PR adding `/android/docs/device.md`: screen px + DPI, input model (touch/D-pad/hardware keys), MMD component inventory (clone the repo, list `com.mudita.mmd.components.*`), e-ink refresh API status, font scaling, "open questions" section.
- Touches: `/android/docs/device.md`
- Deps: 0.3
- Acceptance: doc enumerates confirmed values; unanswered items explicitly flagged.

### Phase 1 — Server APIs

**1.1 Library + delta endpoint** (M)
- Scope: `GET /api/v1/library?changedSince=`; reuses existing query, adds per-volume `updatedAt` and `serverTime`. Bearer-auth.
- Touches: `src/app/api/v1/library/route.ts`
- Deps: 0.1
- Acceptance: Vitest covers full + filtered + empty cases; `changedSince=now` returns empty.

**1.2 Cover thumbnail endpoint** (S)
- Scope: `GET /api/v1/manga/[id]/cover?size=sm|md`, strong ETag, 1y immutable. Reuse existing cover cache + `sharp`.
- Touches: `src/app/api/v1/manga/[id]/cover/route.ts`
- Deps: 1.1
- Acceptance: 200 with bytes; second request with `If-None-Match` returns 304.

**1.3 CBZ archive streaming endpoint** (L)
- Scope: `GET /api/v1/manga/[id]/volume/[volumeNumber]/archive` streams a zip built with `fflate`; entries `0001.jpg`–`NNNN.jpg`; ETag based on max page mtime; `Content-Disposition: attachment`.
- Touches: `src/app/api/v1/manga/[id]/volume/[volumeNumber]/archive/route.ts`, new `src/lib/cbz.ts`
- Deps: 0.1
- Acceptance: `curl -OJ` produces a valid CBZ; `unzip -l` count == DB pageCount; integration test asserts content-type, attachment filename, ETag stability.

**1.4 Progress GET + batch POST** (M)
- Scope: `GET /api/v1/progress?changedSince=`, `POST /api/v1/progress/batch` with LWW. Extract shared logic out of existing per-volume PUT.
- Touches: `src/app/api/v1/progress/route.ts`, `src/app/api/v1/progress/batch/route.ts`
- Deps: 0.1
- Acceptance: tests for new-entry-accepted, older-rejected, same-time-newer-page accepted, missing volume rejected with reason.

### Phase 2 — Android skeleton + onboarding

**2.1 Theme, navigation, DI wiring** (M)
- Scope: `MangaShelfTheme` wrapping `ThemeMMD` (black-on-white, no ripple/motion), Hilt setup, Navigation-Compose graph with 5 placeholder destinations.
- Touches: `android/app/src/main/java/com/mangashelf/reader/{ui/theme, di, ui/nav, MainActivity, MangaShelfApp}.kt`
- Deps: 0.3
- Acceptance: cold-start lands on Onboarding placeholder; nav between placeholders works.

**2.2 TokenStore + Retrofit + AuthInterceptor** (M)
- Scope: `EncryptedSharedPreferences`-backed `TokenStore` (serverUrl + token); Retrofit factory + `AuthInterceptor`; `MangaShelfApi` with `whoami` and `library` endpoints only.
- Touches: `data/store/TokenStore.kt`, `data/remote/**`, `di/NetworkModule.kt`
- Deps: 2.1, 1.1
- Acceptance: JVM test with MockWebServer asserts `Authorization` header set and base URL taken from store.

**2.3 Onboarding screen** (M)
- Scope: server-URL + token fields; "Connect" calls `whoami`; persist on success and route to Library; bad URL/token shows MMD error row.
- Touches: `ui/onboarding/**`
- Deps: 2.2, 0.2
- Acceptance: against running dev server: bad token blocked; good token persists across restart.

### Phase 3 — Library + manga detail

**3.1 Room v1 + library entities + LibraryRepository** (M)
- Scope: Room DB, `MangaDao`/`VolumeDao`, DTO→entity mappers (use `(mangaId, volumeNumber)` as natural key), `LibraryRepository.observeLibrary(): Flow<List<MangaWithVolumes>>`.
- Touches: `data/local/**`, `data/repo/LibraryRepository.kt`
- Deps: 2.2
- Acceptance: instrumented test inserts via DAO and observes flow update; migration smoke test.

**3.2 LibraryDeltaWorker + manual refresh** (S)
- Scope: WorkManager periodic 6h + one-shot worker calling `/v1/library?changedSince=`; persist `lastSyncedAt` in DataStore.
- Touches: `sync/LibraryDeltaWorker.kt`, `di/WorkModule.kt`
- Deps: 3.1
- Acceptance: WorkManager test harness writes rows; second run with same time is a no-op.

**3.3 LibraryScreen** (M)
- Scope: `LazyColumnMMD` of manga rows (cover via Coil with custom fetcher injecting auth header, hitting `/v1/manga/[id]/cover?size=sm`), title, progress count, empty/error states.
- Touches: `ui/library/**`, `ui/common/**`
- Deps: 3.1, 3.2, 1.2
- Acceptance: against dev server with seeded manga, list renders with covers; offline shows cached rows.

**3.4 MangaDetailScreen** (M)
- Scope: lists volumes with status pills; pin/unpin toggle persists to a `pinned` column (no download yet — just state).
- Touches: `ui/manga/**`, `data/local/entities/VolumeEntity.kt` (+`pinned`), DAO updates
- Deps: 3.3
- Acceptance: pinning persists across restart; pills reflect state.

### Phase 4 — Reader

**4.1 CBZ page source + LRU bitmap cache** (M)
- Scope: pure-Kotlin `PageSource` opens a `ZipFile`, enumerates entries, decodes with `BitmapFactory` and `inSampleSize` tuned to display width; 3-bitmap `LruCache`. JVM unit tests with fixture CBZ.
- **Add** `decodeRegion(pageIndex, rect, sampleSize)` using `BitmapRegionDecoder` to render a page sub-region at full resolution — used by the 4.3 zoom (the `inSampleSize` full-page bitmap is too low-res at 3×) and reused by the O.3 OCR crop. Decode only the visible cell rect; recycle on move.
- Touches: `data/reader/PageSource.kt`, `app/src/test/**`
- Deps: 0.3 (no server dep — uses local fixtures)
- Acceptance: unit test opens a 10-page CBZ, retrieves pages 0/5/9, asserts dimensions; region decode of a known sub-rect yields ≈3× the full-view scale.

**4.2 ReaderScreen + tap navigation + local progress write** (L)
- Scope: full-screen `Image` for current page; **left half tap = prev, right half = next, thin top-center strip = toggle MMD top bar** (paged only — no scroll mode, no nav setting); hardware volume keys also advance (handled in `MainActivity`); writes to local `progress` only (server sync is 5.3).
- Gesture coexistence: quick tap navigates; **double-tap on an OCR block → lookup** (stops propagation; debounce single-tap so a double-tap doesn't also flip the page); **long-press anywhere → enter zoom (4.3)**. The gesture detector must disambiguate tap / double-tap / long-press.
- Touches: `ui/reader/**`, `data/repo/ProgressRepository.kt` (local-only writes)
- Deps: 4.1, 3.4
- Acceptance: open a CBZ pushed via `adb push`; left/right tap navigates, top-center toggles bar; close and reopen → resumes on same page.

**4.3 Long-press 9-position zoom** (M, NEW)
- Scope: reader state machine `FullView ↔ Zoom(position ∈ 0..8)`. **Enter:** long-press anywhere → `Zoom(4)` (center-center). **Exit:** back button → `FullView`, same page. The 9 positions are a 3×3 anchor grid at **~3× zoom with ~15% overlap** (boundary text not split), rendered via `PageSource.decodeRegion`, one discrete redraw per move (no animation).
- **Move:** directional swipe shifts the focused cell one step the way you swipe (swipe left → left, right → right, up → up, down → down), clamped at edges; drag/fling detector snaps to the neighbor cell — no continuous panning. Pure touch → no hardware-key / Phase 0.4 dependency.
- **Disabled while zoomed:** OCR overlay interactivity and page-turn (only swipe-to-move or back-to-full). `FullView` re-enables both.
- Touches: `ui/reader/**` (reader mode state, gesture handling, region rendering)
- Deps: 4.1 (region decode), 4.2
- Acceptance: long-press enters at center; the four swipes reach all 9 positions with no seam-cut text; OCR double-tap and page-turn inert while zoomed; back restores the same page with OCR working again.

### Phase 5 — Offline sync

**5.1 DownloadVolumeWorker** (L)
- Scope: WorkManager unique work per volume; streams archive to `filesDir/archives/<mangaId>/v<n>.cbz` via Retrofit `@Streaming`; updates `download_queue` state; emits progress to UI via `WorkInfo.progress`. Pin/unpin from MangaDetail now actually triggers/cancels.
- Touches: `sync/DownloadVolumeWorker.kt`, `data/repo/DownloadRepository.kt`, MangaDetail wiring
- Deps: 1.3, 3.4
- Acceptance: pin on dev wifi → file on disk; airplane-mode mid-download → resumes on reconnect; unpin deletes file.

**5.2 DownloadsScreen** (S)
- Scope: list active + queued + recently failed with progress, cancel, retry.
- Touches: `ui/downloads/**`
- Deps: 5.1
- Acceptance: pin 3 volumes simultaneously; screen shows live progress for each.

**5.3 SyncProgressWorker (push)** (M)
- Scope: debounced batched POST to `/v1/progress/batch` 5s after last write; on success mark `syncedUpdatedAt`; rejected entries clear dirty flag without retry.
- Touches: `sync/SyncProgressWorker.kt`, `data/repo/ProgressRepository.kt`
- Deps: 1.4, 4.2
- Acceptance: read 10 pages offline; reconnect → one batch request goes out with all updates.

**5.4 Progress pull + merge** (S)
- Scope: `LibraryDeltaWorker` (or sibling) also calls `GET /v1/progress?changedSince=` and applies LWW locally.
- Touches: `sync/**`, `data/repo/ProgressRepository.kt`
- Deps: 5.3
- Acceptance: change progress on web → device row updates; device-local newer value not overwritten.

### Phase 6 — Polish

**6.1 E-ink display tuning** (M)
- Scope: kill residual ripple/animation; force `LinearEasing` 0ms where animation unavoidable; add full-refresh hint on page turn if Kompakt requires it. **Requires real device.**
- Touches: `ui/theme/**`, `ui/reader/**`
- Deps: real device available
- Acceptance: manual review — no ghosting after 20 page turns; native feel.

**6.2 Settings, error states, 401 recovery** (M)
- Scope: server URL change (with confirmation purge), Sync Now, Clear Cache, token revoke detection (any 401 → navigate to Onboarding, preserve downloads).
- Touches: `ui/settings/**`, `ui/common/**`, interceptor 401 hook
- Deps: phase 5 complete
- Acceptance: revoke on web → next API call boots user to Onboarding; downloads remain.

**6.3 CI wiring** (S)
- Scope: GitHub Actions split with path filter `android/**` running `./gradlew :app:assembleDebug :app:testDebugUnitTest`; Next.js job filtered to non-android paths.
- Touches: `.github/workflows/**`
- Deps: any green Android build
- Acceptance: PR touching only `/android/` skips Next.js job and vice-versa.

## Verification approach per phase

| Phase | Without device | When device needed |
|---|---|---|
| 0 | Vitest server tests; JUnit Android stub; `assembleDebug` on macOS | never |
| 1 | Vitest integration with token in DB; `curl` against `npm run dev` | never |
| 2 | Android emulator API 28 + MockWebServer; manual click-through against dev server | never |
| 3 | Emulator with seeded `MANGA_DIR`; WorkManager `TestDriver` | optional sanity at end |
| 4 | Push fixture CBZ via `adb push`; emulator reader testing | optional — tap zones may feel different physically |
| 5 | End-to-end on emulator vs `npm run dev`; toggle emulator network state | recommended for large-download cases |
| 6 | — | **required** — e-ink tuning + final UX pass on real Kompakt |

Emulator is LCD, not e-ink. Treat all pre-Phase-6 visuals as "behaviorally correct, visually unverified." Plan a Phase 7 bug-fix loop after the first real-device session (out of scope here).

## Risks / open questions

1. **Kompakt input model unknown.** Touch / D-pad / hardware page-turn buttons? Tap zones in 4.2 may be wrong. Mitigation: session 0.4 must answer before 4.2 starts. If D-pad-only, redesign reader nav.
2. **MMD component gaps.** `com.mudita:MMD:1.0.0` may lack components assumed (progress bars, image-list rows). Mitigation: 0.4 enumerates available; substitute Material3 + e-ink styling where missing.
3. **Bitmap memory on a low-RAM device.** Kompakt heap is likely tight; 3-bitmap LRU may OOM on large pages. Mitigation: 4.1 must use aggressive `inSampleSize`; consider tile rendering if pages exceed 4 MP.
4. **No e-ink refresh control from a regular Android app.** If MuditaOS doesn't expose a refresh API, ghosting will accumulate. Mitigation: 6.1 may need a full-screen flash hack; confirm in 0.4.
5. **Server ID churn.** When a manga folder is removed and re-added with the same name, IDs change — client downloads keyed by `volumeId` would orphan. Mitigation: use `(mangaId, volumeNumber)` as the client-side natural key (decided in 3.1).
6. **`/v1/` namespacing locks legacy clients out.** The web app keeps using non-`/v1/` cookie routes. Fine for now, but if the web app ever migrates, the `/v1/` namespace is the migration target.
7. **rsdroid AAR API drift / proto versioning.** The backend's Protobuf service IDs and the bundled Anki version move between releases; pin a known-good AAR version and regenerate protos on bump. Mitigation: lock version in `libs.versions.toml`; F.1 includes a round-trip smoke test.
8. **Card-render parity for FSRS intervals.** A bug in how we read/display the backend's next-interval would silently mislead reviews. Mitigation: F.3 test-vector check against desktop Anki outputs.
9. **CJK font presence unverified on device.** System font is Latin-only "Lato" (confirmed); bundling Noto Sans JP is mandatory, not optional. Verify on hardware in Phase 6.
10. **E-ink ghosting on long dict entries / manga-crop card backs.** Mitigation: page-flip over scroll + grayscale downsample + periodic full refresh. Verify on device.
11. **Dictionary gate must not be bypassed.** No dictionary code before the dedicated brainstorming session; the OCR popup ships with a placeholder lookup pane until then.
12. **APK size.** arm64-only rsdroid split (~9–12 MB native) + bundled font + (later) dictionary data on internal storage. Confirm fits the 32 GB device budget; dictionaries are user-imported, not bundled in the APK.
13. **Zoom swipe-direction is literal** ("swipe left = move focus left", opposite of content-drag panning). If it feels inverted on device it's a one-line sign flip — confirm on the Phase 6 hardware pass.
14. **Reader gesture disambiguation on e-ink touch.** tap / double-tap / long-press / swipe must not misfire (e.g. a slow tap read as long-press → accidental zoom). Tune thresholds; verify on real hardware in Phase 6.

## Critical files to inspect when starting work

- `src/db/schema.ts` — current schema (manga, volume, readingProgress, better-auth tables)
- `src/lib/auth.ts`, `src/lib/auth-helpers.ts` — current session auth
- `src/app/api/manga/[id]/volume/[volumeNumber]/pages/route.ts` — page enumeration logic to mirror in archive endpoint
- `src/app/api/manga/[id]/volume/[volumeNumber]/page/[pageNumber]/route.ts` — page resolution + thumbnail logic
- `src/app/api/progress/[mangaId]/[volumeId]/route.ts` — existing LWW logic to extract into shared helper for batch endpoint
- `src/lib/scanner.ts` — folder/page conventions to honor when zipping
- `package.json` — `fflate` already present for streaming zip; `sharp` for cover sizing

For the **Extension** work below, also inspect the web features being ported/replaced:
- `src/components/ocr-overlay.tsx` — transparent tappable OCR block overlay (behavior to mirror natively)
- `src/lib/mokuro.ts`, `src/app/api/manga/[id]/volume/[volumeNumber]/ocr/route.ts` — `.mokuro` loader + reader OCR route to mirror under `/v1/`
- `src/components/anki-card-dialog.tsx` — mining popup + `buildCardBack()` (card field model to replicate)
- `src/lib/anki/**`, `src/hooks/use-anki.ts` — current AnkiConnect flow (replaced on-device by the local rslib collection; web stays as-is)
- `src/lib/dict/**` — offline dict engine (`transforms/ja-transforms.ts` deinflector, `install/parse-bank.ts`, `db/idb.ts`) — reference for the GATED native port

---

# Extension: OCR-on-device, native Flashcards, gated Dictionary (added 2026-05-29)

Turns the reader-only port into a **self-contained offline Japanese-study bundle**: Reader + OCR lookup + (gated) Dictionary + local Anki-style Flashcards, in one app, so the user never switches apps mid-read.

**Why:** the existing study stack can't run on the Kompakt. The web app uses Mokuro OCR overlays, an IndexedDB/Web-Worker Yomitan dictionary, a mining popup, and card creation that **pushes to a running desktop Anki over AnkiConnect**. On a de-googled, offline e-ink phone there is no desktop Anki, IndexedDB/Web-Worker can't run natively, and the Mokuro overlay must be re-rendered in Compose — so three things are ported/replaced natively.

**Target flows (all offline):**
1. Read → double-tap bubble → OCR text → dictionary lookup popup → create flashcard from the selected sense (or whole entry) into a chosen deck.
2. Look up words/phrases/conjugations/kana/kanji in the local dictionary → make a flashcard from an entry.
3. Study flashcards (Anki-identical scheduling, 4 buttons, undo, heatmap, import/export).

## Decisions (extension session)

| Topic | Choice | Note |
|---|---|---|
| App shape | 3-pillar bundle: Reader(+OCR) / Dictionary / Flashcards | |
| Flashcard engine | **Reuse Anki's Rust backend** via the prebuilt rsdroid AAR (`io.github.david-allison:anki-android-backend`), JNI + Protobuf | not a reimplementation |
| Scheduler | **FSRS** on by default (rslib ships FSRS **and** legacy SM-2; toggle like Anki) | FSRS is opt-in in real Anki; user wants it on |
| Card rendering | **Native Compose** (Text + image + small HTML-subset renderer); **skip** rslib's WebView/MathJax reviewer | e-ink fit |
| CJK font | **Bundle Noto Sans JP**; do not rely on system fallback | Kompakt system font is Latin-only "Lato" |
| OCR on device | **In scope now**: serve `.mokuro` + native overlay; lookup-wiring gated on dictionary | |
| Card mining target | **Mudita-local collection** (`addNote` into a chosen deck); web AnkiConnect flow **unchanged** | |
| Deck transfer | **USB file** (`.apkg`/`.colpkg` via Mudita Center / MTP). No server sync, no AnkiWeb sync | |
| ABI | **arm64-v8a only** split (Helio A22) | drops ~17 MB other-ABI native code |
| Dictionary internals | **GATED** — separate brainstorming session before ANY dictionary code | |

**Offline guarantee:** rslib is a local lib compiled into the APK; scheduling, storage, import/export, stats run on-device. Its only networked capability (AnkiWeb sync) is opt-in and never called — the bundle works in airplane mode.

**Licensing (informational, not legal advice):** rslib is AGPL-3.0, rsdroid bridge GPL-3.0. For purely-local, non-distributed personal use (sideloaded to the user's own phone) there is zero copyleft obligation (triggers only on distribution; AGPL §13 only on third-party network interaction). Distributing/publishing the APK would force the whole app to become (A)GPL source-available.

## Research basis (adversarially verified)

- **Anki's default scheduler is still legacy SM-2; FSRS is opt-in** (verify pass refuted "FSRS is default" via the Anki manual, dev statements, and GitHub issue #3616, Dec 2024). rslib provides both → FSRS-on is just a default toggle.
- **rslib reuse is real, Kotlin-proven** (AnkiDroid is the proof). Prebuilt AAR on Maven Central. JNI surface is tiny: `openBackend(ByteArray)`, `closeBackend(Long)`, `runMethodRaw(ptr, service, method, args)` — every op a Protobuf request/response; generate Kotlin from Anki's `.proto`. Gives FSRS+SM-2 scheduling, `.apkg`/`.colpkg` import/export **with full revlog history**, media, stats. arm64 `.so` ~23 MB uncompressed (~9 MB in-APK).
- **`.colpkg`** = full collection, always full history, replace-on-import; **`.apkg`** = deck(s), additive, history when "scheduling info" on. The `revlog` table is the full review history — rslib handles all of it, we don't hand-parse.
- **Kompakt:** AOSP 12, de-googled, Chromium WebView frozen at v128. Native Compose beats WebView for card/dict rendering on 3 GB RAM e-ink. Bundle a CJK font. Page-flip over scroll; grayscale-downsample manga crops to cut ghosting.

## Amend: scope, repo, nav

- App shell grows from the 5-destination nav graph (Phase 2.1) to a top-level **3-section shell** (Reader / Dictionary / Flashcards) — MMD bottom nav or drawer, e-ink-styled. Shared onboarding + settings.
- New Android packages: `flashcards/` (`data/`, `srs/`, `ui/{review,decks,stats,settings,importexport}`), `ocr/` (`MokuroModel.kt`, `OcrOverlay.kt`), `dict/` (**placeholder until the gate clears**).
- New Gradle deps: rsdroid AAR + Protobuf (Wire or protobuf-javalite) + Coil + bundled font asset. arm64-v8a `splits`/`abiFilters`.

## Server change (Reader/OCR track)

**O-S.1 — OCR sidecar endpoint** (S)
- `GET /api/v1/manga/[id]/volume/[volumeNumber]/ocr` → volume's `.mokuro` JSON, bearer-auth, ETag on file mtime, 404 if not yet OCR'd. Reuse `src/lib/mokuro.ts`; mirror the existing reader OCR route.
- Touches: `src/app/api/v1/manga/[id]/volume/[volumeNumber]/ocr/route.ts`. Deps: existing 0.1.
- Acceptance: bearer `curl` returns the JSON; 304 on `If-None-Match`; non-Japanese volume → 404.

*(No other server changes. Flashcards + Dictionary are 100% device-local — no API, no sync.)*

## Reader OCR overlay (extends Phase 4/5)

**O.1 — Download `.mokuro` with the volume** (S) — `DownloadVolumeWorker` (5.1) also fetches the sidecar to `filesDir/archives/<mangaId>/v<n>.mokuro`; skip silently on 404; unpin deletes both. Deps: 5.1, O-S.1.

**O.2 — Mokuro model + native overlay** (M) — port `.mokuro` shape (page → blocks → box + lines + vertical flag) to `ocr/MokuroModel.kt`; render transparent, absolutely-positioned tappable blocks scaled to displayed page size; **double-tap → `onBlockSelect(text, box)`** (long-press is reserved for zoom 4.3 — do NOT port the web's long-press→`onBlockSelect` alias at `ocr-overlay.tsx:104-110`). Overlay reads reader mode: in `Zoom` (4.3), pass no `onBlockSelect` (mirror web callback-gating `ocr-overlay.tsx:93-122`) and hide the overlay to cut ghosting; re-enable on `FullView`. Reader-settings toggle as on web. Deps: 4.2, 4.3, O.1. Acceptance: blocks align to bubbles offline; double-tap fires selection; nothing fires while zoomed.

**O.3 — Lookup popup shell** (S) — block-select opens an MMD dialog with selectable OCR text + a **"Create card"** action (image + sentence) wired to `F.8`. **Dictionary-lookup pane is a placeholder** until the Dictionary pillar lands. Image crop done **natively** from the local CBZ page bitmap (`BitmapRegionDecoder` on box + padding) — replaces web `/api/anki/capture` + `sharp`. Deps: O.2, F.8.

## Pillar — Flashcards (Anki-compatible local SRS), buildable independently

Depends only on the Android skeleton (0.3 + 2.1). No server/dictionary/reader dependency. Native Compose rendering throughout.

**F.1 — rsdroid backend integration** (L) — add the AAR (arm64-only), Protobuf codegen from Anki's `.proto`, thin `AnkiBackend` wrapper over `openBackend/closeBackend/runMethodRaw`; open/create a local collection in `filesDir`. Touches: `flashcards/data/BackendModule.kt`, generated proto, `libs.versions.toml`, app `build.gradle.kts` (abiFilters). Acceptance: test opens a fresh collection, round-trips a Protobuf call, closes cleanly; `assembleDebug` (arm64) succeeds.

**F.2 — Collection bootstrap + mining note type + DI** (M) — first run creates a default "Mining" deck + a **"MangaShelf Mining" note type** (`Sentence`, `Image`, `Definition`, `Source` — matches web `buildCardBack()`); enable FSRS globally, desired-retention 0.90; `CollectionRepository` exposes decks + due counts as Flows. Deps: F.1.

**F.3 — Review screen** (L) — backend due queue (respects new/day, reviews/day, rollover); front → Show Answer → back; four buttons **Again/Hard/Good/Easy** each labeled with the **backend-reported next interval** (1:1 Anki); answering calls `answerCard` (FSRS). Native renderer: JP sentence (Noto Sans JP) + manga-crop image (Coil, grayscale downsample) + Definition via a **small HTML-subset renderer** (bold/italic, lists, ruby/furigana, colored POS). Page-flip nav, minimal repaint. Deps: F.2. Acceptance: button intervals match desktop-Anki FSRS for the same input (test-vector).

**F.4 — Undo** (S) — wire backend undo to an Undo affordance. Deps: F.3.

**F.5 — Scheduler settings** (M) — "next day starts at" (default 4am), max new/day (20), max reviews/day (200), FSRS on/off + desired retention; persist via backend deck-config (single global preset to start). Deps: F.3.

**F.6 — Calendar heatmap (total, all decks)** (M) — Anki-style heatmap of total reviews/day across all decks from `revlog` (grouped by day, rollover-aware); scrollable year grid, e-ink high-contrast buckets. Deps: F.3.

**F.7 — Import / export with full history** (M) — import `.apkg`/`.colpkg` from a file picker / Mudita Center/MTP; export `.colpkg` (full backup) and `.apkg` (deck share) via backend `import_export` — **full revlog history preserved**. Deps: F.1. Acceptance: import a desktop `.colpkg` (history + due intact); export → re-open in desktop Anki, scheduling matches.

**F.8 — Card creation (mining) API** (S) — `CollectionRepository.addMiningNote(deckId, sentence, imageBytes, definitionHtml?, source, tags)` → store media via backend, `addNote` into chosen deck; deck-picker (default "Mining"); tag templating like web `expandTags()`. Consumed by O.3 now and the dictionary→card flow later. Deps: F.2.

## Pillar — Dictionary — ⛔ GATED (do NOT implement yet)

> **GATE — explicit user instruction.** How the offline Japanese dictionary must work (matching Jisho / the iOS "Japanese" app as closely as possible) is a **large mechanic still to be discussed in a dedicated brainstorming session.** Claude is **NOT permitted to write any dictionary code or finalize a dictionary sub-plan until that session happens and its decisions are recorded here.** This pillar is a placeholder.

**Open questions for that session (from research):**
1. **Port vs WebView-reuse** — port the TS engine (`src/lib/dict/**`) to Kotlin+SQLite (durable, recommended) vs ship the TS engine in a WebView+IndexedDB (fast prototype, eviction/persistence risk, fights e-ink).
2. **Lookup model** — tap-to-lookup with the rule deinflector + exact-key SQLite index (lean) vs full-sentence segmentation via a morphological tokenizer (Kuromoji/Sudachi, +100 MB, lemma reconciliation).
3. **Store** — SQLite plain B-tree indexes (recommended; FTS5 is poor for CJK) vs Room vs KV; how to store/query Yomitan structured-content glossary JSON.
4. **Glossary rendering** — native composable renderer vs minimal HTML view for Yomitan structured content on e-ink.
5. **Dictionary distribution** — bundle a default dict vs user-imports Yomitan zips at runtime.
6. **Storage budget** — which dicts in scope (Jitendex + KANJIDIC; JMnedict? frequency banks?), internal non-evictable storage, hard ceiling.
7. **Deinflection coverage** — port existing `ja-transforms.ts` as-is vs re-derive from upstream Yomitan.
8. **Jisho / "Japanese"-app parity** — which features (radical/kanji search, example sentences, conjugation tables, pitch accent, audio) are in scope.

**Integration points it must satisfy** (so the gate doesn't block other pillars): expose `lookup(text): List<Entry>` and `scan(text): tokens+hits` to (a) the OCR popup pane (O.3) and (b) a standalone dictionary search screen; expose per-sense data to feed `F.8 addMiningNote` as `definitionHtml`.

## Integration flow (partly gated)

- **Built now:** reader OCR overlay (O.*) → popup → `F.8` create card (image + sentence). Standalone "add card" works.
- **Gated on Dictionary session:** the lookup pane in the OCR popup (sense → `definitionHtml`) and the standalone dictionary-search → make-card flow. These light up once the dictionary pillar exposes the integration points above.

## Suggested build order

1. Existing Phase 0–3 — unchanged.
2. **Flashcards F.1–F.8** — parallel with reader work once the skeleton (0.3/2.1) exists; no cross-deps; de-risks the rslib integration early.
3. Existing Phase 4–5 + **O-S.1, O.1–O.3** interleaved.
4. 3-section app shell (amend 2.1) once two pillars exist.
5. **Dictionary session (GATE)** → Dictionary phases → integration wiring.
6. Existing Phase 6 polish + device pass (now also covers card/dict e-ink rendering + CJK-font verification on hardware).

## Verification (new pillars)

| Area | Without device | With device |
|---|---|---|
| OCR endpoint (O-S.1) | Vitest + `curl` vs `npm run dev`; assert mokuro JSON + ETag/404 | never |
| OCR overlay (O.1–O.3) | Emulator + `adb push` a `.mokuro`; assert block alignment + selection | recommended (tap feel) |
| Flashcards F.1 | `assembleDebug` (arm64) + instrumented open/round-trip/close | never |
| Flashcards F.3 | Seed deck; **FSRS test-vector parity** vs desktop Anki; emulator review | optional |
| Import/export F.7 | Import a desktop `.colpkg`, assert history/due intact; export → re-open in desktop Anki | never |
| Heatmap F.6 | Seed `revlog`; assert per-day totals + rollover | optional |
| Card/dict e-ink render | emulator visuals (LCD — behaviorally correct, visually unverified) | **required** — ghosting, CJK font, page-flip |

End-to-end manual check: airplane mode → read pinned Japanese volume → double-tap bubble → (post-dictionary) lookup → create card → study deck (4 buttons, undo) → export `.colpkg` over USB → re-import on desktop Anki with history intact.
