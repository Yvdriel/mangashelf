# Modularity Audit — MangaShelf

## 1. Summary

MangaShelf is a well-intentioned two-domain app (Reader + Manager) whose service layer has grown organically without enforced boundaries. The single largest structural problem is `src/lib/importer.ts` (1,409 lines), which fuses four distinct concerns: filesystem traversal, volume-number parsing, file-copying logic, and background-task orchestration. Beyond that, `src/lib/` is a flat grab-bag of 20 root-level files where unrelated infrastructure (cover cache, theme, auth helpers, import session, image resolver) sit alongside domain services. Formatting utilities (`formatBytes`, `formatSpeed`) are copy-pasted in at least seven separate files. The `MANGA_DIR` path constant is independently defined with `process.env.MANGA_DIR || "/manga"` in nine source files. `IMAGE_EXTENSIONS` is defined in six. The import-wizard route handler (`src/app/api/import/progress/[importId]/route.ts`, 411 lines) embeds full manager persistence and library sync logic rather than delegating. The account-settings component (`src/components/auth/account-settings.tsx`, 645 lines) is a God component with 23 `useState`/`useEffect` invocations spread across dozens of unrelated sub-sections that each belong as standalone components. Overall the codebase is readable and not unmaintainable, but it is ten refactors short of having real module boundaries.

---

## 2. God Files

**`src/lib/importer.ts` — 1,409 lines**
Exports 25 symbols across five completely different responsibility layers:
- Filesystem discovery (`findImageFiles`, `findVolumeFolders`, `findDirectImageFiles`)
- Volume-number parsing (`normalizeFolderName`, `extractVolumeNumber`, `extractVolumeNumberWithAncestors`, `assignVolumeNumbers`, `parseBatchRange`, `resolveDuplicate`)
- Page sorting (`detectCommonPrefix`, `parsePageSortKey`, `parseSegment`, `sortImageFiles`, `compareSortKeys`)
- File-copy import logic (`importVolume`, `importVolumeMove`, `getExistingVolumeNumbers`)
- Download-progress polling and background task orchestration (`updateDownloadProgress`, `updateBulkDownloadProgress`, `checkAndImportDownloads`, `checkAndImportBulkDownloads`, `startBackgroundTasks`, `progressTick`, `importTickFull`)

The download-progress concern (lines 740–1409) alone accounts for 669 lines and drives DB writes, Deluge polling, and timer management — none of which are related to "how to copy image files into the library."

**`src/app/api/import/progress/[importId]/route.ts` — 411 lines**
A route handler that contains: SSE streaming setup, file-system replace-to-trash logic, two different import code paths (copy vs. move), library sync, manager upsert with AniList metadata fetch, managed-volume DB writes, import-history recording, and session cleanup. The handler has one `GET` function that runs for over 350 lines. A route handler should contain: validate → delegate → stream response.

**`src/app/api/import/analyze/route.ts` — 356 lines**
Contains its own title-parsing business logic (`tryParseTitleFromPath`, 28 lines inline), filesystem traversal to count existing pages in the library (duplicating what `importer.ts` already does), AniList search to auto-confirm a match, and full analysis assembly. Four concerns that should live in a service.

**`src/app/api/import/upload/route.ts` — 224 lines**
Implements a full multipart streaming parser from scratch (`parseMultipartFiles`, lines 154–224) inside a route handler. That parser is 70+ lines of binary buffer slicing that belongs in a standalone utility.

**`src/components/anki-card-dialog.tsx` — 817 lines**
One file that contains: the `AnkiCardDialog` modal component, a `DefinitionPanel` component with its own full state machine and debounced async lookup, a `TokenStream` renderer, a `RichResult` renderer with hit/sense navigation, a `Glossary` + `StructuredContentRenderer` component subtree, a `KanjiStrip` component, and the `buildCardBack` / `renderGlossaryHTML` / `renderStructuredHTML` functions that serialize dictionary results to Anki HTML. That last concern — converting a dictionary result to Anki card HTML — is pure domain logic that does not belong anywhere near the rendering tree.

**`src/components/auth/account-settings.tsx` — 645 lines**
Houses `AccountSettings` plus seven independent section components (`ProfileSection`, `ChangePasswordSection`, `TwoFactorSection`, `PasskeySection`, `SessionsSection`) each with their own `useState`/`useEffect` lifecycle. Counted 23 hook invocations in this file. Each section is a standalone feature and should be its own file.

**`src/components/manager/manga-detail.tsx` — 512 lines**
Combines hero-section layout, volume-list display, bulk-download tracking, monitoring controls, torrent approval, download history, and deletion. Contains `formatSpeed` and `formatTimeAgo` as private functions. Mixing presentation, business logic gating, and API calls.

**`src/components/manager/manager-page.tsx` — 492 lines**
Mixes AniList search, result rendering, "add to manager" mutation, multi-select state (`useMultiSelect`), bulk-delete flow, monitor-all trigger, and the complete card grid rendering. 9 `useState` calls at the top level.

**`src/lib/ocr.ts` — 432 lines**
Mixes: the OCR queue public API (`enqueueVolumeOcr`, `enqueueOcrForManga`), DB query helpers for the `volume_ocr` table (`markFailed`, `markReady`, `markRunning`, `nextDispatchable`), the dispatcher state machine (`processOnce`, `singleFlightProcessOnce`), the background task timer (`startOcrDispatcher`, `intervalTick`), and read-only query functions for the UI (`getMangaOcrSummary`, `getVolumeOcrStatuses`, `resolveMokuroFile`). Three distinct layers in one file.

**`src/lib/monitor.ts` — 400 lines**
Combines: torrent scoring logic (`scoreTorrent`, `getMedianSize`), the search-and-download loop for individual manga (`monitorSingleManga`), AniList metadata refresh (`refreshReleasingManga`), the top-level monitoring cycle (`runMonitoringCycle`), and the background task timer (`startMonitorInterval`). The scoring/ranking logic should be separate from the persistence loop.

**`src/lib/system/health-checks.ts` — 369 lines**
A single 335-line function `runHealthChecks` that contains inline `formatBytes`, inline filesystem checks, inline DB queries, and inline task-registry inspection. The function's body reads as a script, not a composed set of concerns.

**`src/lib/system/service-checks.ts` — 336 lines**
Three service checks (Deluge, Jackett, AniList) each with their own RPC/HTTP plumbing duplicated inside a single file. The Deluge check at lines 64–145 alone replicates the auth/session logic that `src/lib/deluge.ts` already owns differently.

**`src/app/manga/[id]/page.tsx` — 357 lines**
A server page component that performs: session guard, two domain DB queries (reader + manager), JSON parsing for genres/staff, author/artist derivation from staff edges, reading-progress calculation, continue-reading target logic, OCR summary fetch — all before rendering a hero section, description section, and a volume grid. The data-prep logic (50+ lines above the `return`) should live in a query/service layer.

---

## 3. God Functions / Components

**`src/lib/importer.ts:1038` — `checkAndImportDownloads` — 231 lines**
Polls Deluge, marks volumes as downloaded, fetches the parent manga, extracts archives, detects multi-volume downloads, iterates volumes, persists each result, triggers library sync, updates download history. Seven responsibilities in one async function.

**`src/lib/importer.ts:832` — `checkAndImportBulkDownloads` — 200 lines**
Same structure as `checkAndImportDownloads` but for bulk torrent IDs. The two functions share 80% of their code (extract → find volume folders → assign numbers → import each → update DB) without a shared abstraction.

**`src/lib/system/health-checks.ts:34` — `runHealthChecks` — 335 lines (the entire file body)**
Inline filesystem access, inline DB queries, inline task-registry inspection, and over 20 independent check blocks. Should be decomposed into category-namespaced check functions.

**`src/app/api/import/progress/[importId]/route.ts:27` — `GET` handler — 384 lines**
The SSE stream `start` callback runs from line 54 to 401. It contains the complete import execution pipeline inlined.

**`src/components/anki-card-dialog.tsx:283` — `DefinitionPanel` — ~140 lines**
Runs debounced async lookup, manages three independent pieces of selection state (`tokenIdx`, `hitIdx`, `senseIdx`), renders four different UI states (empty, loading, error, results), and delegates to sub-components. Should be a custom hook + smaller component.

**`src/lib/importer.ts:310` — `assignVolumeNumbers` — 103 lines**
Takes folder paths, resolves volume numbers, groups duplicates, runs deduplication, handles three different fallback cases for unresolved folders, returns sorted results. Mixes strategy selection with iteration with persistence concerns.

**`src/lib/ocr.ts:244` — `processOnce` — 69 lines**
Implements a state machine (queued → dispatched → polling → ready/failed/requeued) inline. Each state transition (8 of them) should be a named function.

**`src/components/auth/account-settings.tsx` — `AccountSettings` subtree**
The file as a whole has 23 `useState` invocations (counted by `grep -c`). `TwoFactorSection` (approximately lines 200–380) alone manages 2FA enable/disable flows, QR code generation (importing `qrcode` inline), OTP verification, and backup-code display in a single function. `PasskeySection` and `SessionsSection` each handle their own full async lifecycle.

**`src/components/manager/manager-page.tsx:44` — `ManagerPage` — 448 lines**
9 `useState` calls. Mixes search state, result rendering, add-to-manager mutation, multi-select state, delete flow, and monitor-run trigger in one component.

---

## 4. Dumping-Ground Folders

### `src/lib/` (root level — 20 files)

Contents:
- `anilist.ts` — AniList GraphQL client (fits in a `src/lib/integrations/` or `src/services/` slot)
- `api.ts` — tiny client-side fetch helper; 19 lines; stands alone fine
- `auth-client.ts` — BetterAuth client instance
- `auth-helpers.ts` — `getSession` / `requireAdmin`; 15 lines
- `auth.ts` — BetterAuth server config; 75 lines
- `cover-cache.ts` — disk-based cover caching; belongs with manga or media infrastructure
- `deluge.ts` — Deluge JSON-RPC client; integration/adapter concern
- `extractor.ts` — archive extraction; belongs with import pipeline
- `image-resolver.ts` — resolves page image paths; belongs with reader domain
- `import-session.ts` — in-memory session store; belongs with import pipeline
- `import-types.ts` — shared import types; belongs with import pipeline
- `importer.ts` — main import engine; belongs with import pipeline
- `jackett.ts` — Jackett search client; integration/adapter concern
- `mokuro-client.ts` — mokuro HTTP client; belongs with OCR pipeline
- `mokuro.ts` — path helpers; belongs with OCR pipeline
- `monitor.ts` — manager monitoring loop; belongs with manager domain
- `ocr.ts` — OCR queue + dispatcher; belongs with OCR pipeline
- `scanner.ts` — library filesystem scanner; belongs with reader domain
- `theme.ts` — CSS variable application; belongs with UI layer
- `thumbnails.ts` — thumbnail generation; belongs with media/image infrastructure

Nothing in `src/lib/` should be there. Every file is a domain service, an integration adapter, an infrastructure utility, or a pipeline component. All 20 files land in the same directory with no implied grouping.

Suggested regrouping:

- `importer.ts`, `extractor.ts`, `import-session.ts`, `import-types.ts` → `src/lib/import/`
- `scanner.ts`, `image-resolver.ts`, `cover-cache.ts`, `thumbnails.ts` → `src/lib/reader/`
- `monitor.ts` → `src/lib/manager/`
- `ocr.ts`, `mokuro.ts`, `mokuro-client.ts` → `src/lib/ocr/`
- `anilist.ts`, `jackett.ts`, `deluge.ts` → `src/lib/integrations/`
- `auth.ts`, `auth-client.ts`, `auth-helpers.ts` → `src/lib/auth/` (already implied by naming; no subdirectory exists)
- `theme.ts` → `src/lib/ui/` or inline into the theme context
- `api.ts` → stays or moves into a `src/lib/client/` for client-side utilities

### `src/components/` (root level — 25 files)

Contains genuinely unrelated things:
- Reader-specific: `reader.tsx`, `ocr-overlay.tsx`, `ocr-manga-button.tsx`
- Library/browse: `library-filter.tsx`, `manga-card.tsx`, `manga-description.tsx`
- Anki: `anki-card-dialog.tsx`, `anki-settings.tsx`
- Download: `download-indicator.tsx`, `downloads-page.tsx`, `global-download-progress.tsx`
- Auth UI: `login-form.tsx` (in `auth/`), but `user-menu.tsx` is at root
- Utilities: `confirm-dialog.tsx`, `selection-bar.tsx`, `logo.tsx`, `nav.tsx`, `themed-toaster.tsx`, `sw-register.tsx`, `copy-handler.tsx`, `theme-picker.tsx`
- Settings: `reader-settings.tsx`, `text-tools-settings.tsx`, `dict-settings.tsx`

Suggested regrouping:
- `anki-card-dialog.tsx`, `anki-settings.tsx` → `src/components/anki/`
- `reader.tsx`, `ocr-overlay.tsx`, `ocr-manga-button.tsx` → `src/components/reader/`
- `library-filter.tsx`, `manga-card.tsx`, `manga-description.tsx` → `src/components/library/`
- `download-indicator.tsx`, `downloads-page.tsx`, `global-download-progress.tsx` → `src/components/downloads/`
- `reader-settings.tsx`, `text-tools-settings.tsx`, `dict-settings.tsx` → `src/components/settings/`
- `user-menu.tsx` → `src/components/auth/`

---

## 5. Mixed Concerns

**`src/lib/importer.ts`** — Filesystem utility layer + business-logic layer + background-task runtime layer. Lines 1–735 are pure computation (filesystem discovery and file copying); lines 736–1409 are async I/O with DB writes and timer management. These two halves have different test requirements, different change rates, and different callers.

**`src/app/api/import/progress/[importId]/route.ts`** — Route handler + import execution engine + manager persistence + library synchronization + history recording. The file should say "read config → call service → stream events." Instead it is the service.

**`src/app/api/import/analyze/route.ts`** — Route handler + filesystem analysis business logic + AniList API call + duplicate-detection logic. The `tryParseTitleFromPath` function (lines 49–76) is business logic embedded in a route file.

**`src/lib/ocr.ts`** — Public enqueueing API + internal dispatcher state machine + background timer + read-model query functions. The read-model queries (`getMangaOcrSummary`, `getVolumeOcrStatuses`, `resolveMokuroFile`) are used exclusively by API route handlers and have no relationship to the dispatcher loop.

**`src/lib/monitor.ts`** — Torrent-scoring algorithm (`scoreTorrent`, `getMedianSize`, lines 25–53) + monitoring loop that calls DB, Jackett, Deluge, and AniList + metadata-refresh loop + background timer. The scoring algorithm is a pure function that can be extracted and unit-tested; it is currently buried inside the loop file.

**`src/lib/system/service-checks.ts`** — Contains a duplicate minimal Deluge RPC implementation (`delugeRpc`, lines 32–62) that is entirely separate from `src/lib/deluge.ts`. The Deluge connectivity check reinvents auth/session handling that `deluge.ts` already owns, because `service-checks.ts` cannot reuse `deluge.ts` without leaking state.

**`src/components/anki-card-dialog.tsx`** — UI rendering + dictionary lookup business logic + Anki-card HTML serialization (`buildCardBack`, `renderGlossaryHTML`, `renderStructuredHTML`, lines 719–813). The HTML serialization is a pure domain function that has no business being inside a React component file.

**`src/lib/scanner.ts`** — Library sync orchestration + task registration. The `registerTask("library-scan", ...)` call at line 110 embeds background-task wiring inside what is otherwise a pure filesystem→DB sync module.

**`src/app/manga/[id]/page.tsx`** — Server component rendering + multi-query data fetching + business-logic derivation (continue-reading target, author/artist extraction from JSON). Lines 39–139 are a service function that should be extracted.

---

## 6. Scattered Domain Logic

### "Manga title resolution" (`titleNative || titleRomaji || titleEnglish`)

The three-way title fallback chain is an invariant of the managed-manga domain:

- `src/lib/monitor.ts:89` — `manga.titleNative || manga.titleRomaji || manga.titleEnglish || ""`
- `src/lib/importer.ts:873` — `manga.titleRomaji || manga.titleEnglish || \`Manga ${manga.anilistId}\``
- `src/lib/importer.ts:1110` — same as above
- `src/app/api/downloads/status/route.ts:82` — `r.titleNative || r.titleRomaji || r.titleEnglish || "Unknown"`
- `src/components/manager/manga-detail.tsx:117` — `manga.titleNative || manga.titleRomaji || manga.titleEnglish || ""`
- `src/components/manager/manager-page.tsx:77` — same pattern
- `src/app/manager/[id]/page.tsx` — multiple inline instances

The `importer.ts` version skips `titleNative` (a silent inconsistency). A single `resolveTitle(manga)` function in a managed-manga module would enforce one consistent fallback order.

### "Image file filtering" (`IMAGE_EXTENSIONS`)

The set `[".jpg", ".jpeg", ".png", ".webp"]` and the predicate `IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase())` are independently defined in:

- `src/lib/importer.ts:30`
- `src/lib/scanner.ts:25`
- `src/lib/image-resolver.ts:8`
- `src/app/api/import/analyze/route.ts:29`
- `src/app/api/import/browse/route.ts:10`
- `src/app/api/import/preview/[sessionId]/[volumeIndex]/[pageIndex]/route.ts:10`
- `src/app/api/manga/[id]/volume/[volumeNumber]/pages/route.ts:10`

Seven definitions of the same constant. Any addition of a new image format (e.g. `.avif`) must be made in seven places.

### `MANGA_DIR` path constant

`const MANGA_DIR = process.env.MANGA_DIR || "/manga"` appears in nine files:

`src/lib/importer.ts`, `src/lib/scanner.ts`, `src/lib/ocr.ts`, `src/lib/cover-cache.ts`, `src/lib/thumbnails.ts`, `src/app/api/import/analyze/route.ts`, `src/app/api/import/progress/[importId]/route.ts`, `src/app/api/import/browse/route.ts`, `src/app/api/delete/route.ts`

### "Format bytes/speed" formatting utilities

`formatBytes` is independently implemented as a private function in:
- `src/lib/system/health-checks.ts:26`
- `src/components/system/DiskUsage.tsx:14`
- `src/components/system/ServiceCard.tsx:10`
- `src/components/system/SystemAbout.tsx:23`
- `src/components/dict-settings.tsx:242`
- `src/workers/dict-worker.ts:60`

`formatSpeed` is independently implemented in:
- `src/components/manager/manga-detail.tsx:48`
- `src/components/downloads-page.tsx:6`
- `src/components/download-indicator.tsx:7`
- `src/components/global-download-progress.tsx:6`
- `src/components/system/ServiceCard.tsx:18`

### "Torrent name extraction" from magnet link

```
magnetLink.match(/dn=([^&]+)/)?.[1]?.replace(/\+/g, " ")
```

This one-liner appears in:
- `src/lib/monitor.ts:169`
- `src/app/api/manager/manga/[id]/download/route.ts:71`

Two slightly different downstream handling (one `decodeURIComponent`s, one does not).

### Download-status persistence after torrent completes

The sequence "check Deluge → mark as downloaded → find manga → extract → find volume folders → import → mark as imported → update downloadHistory" is implemented twice:

- `checkAndImportDownloads` (`src/lib/importer.ts:1038`) — single-volume path
- `checkAndImportBulkDownloads` (`src/lib/importer.ts:832`) — bulk path

They share no helper functions despite 80% structural similarity.

---

## 7. Procedural Code That Should Be Encapsulated

**Volume-number extraction pipeline** (`src/lib/importer.ts:139–413`)
`normalizeFolderName` → `extractVolumeNumber` → `extractVolumeNumberWithAncestors` → `parseBatchRange` → `resolveDuplicate` → `assignVolumeNumbers` are six functions operating on a `VolumeCandidate` type that is private to the file. These free-standing functions form a cohesive pipeline with a private intermediate type and should become a `VolumeNumberResolver` class or a dedicated `src/lib/import/volume-numbering.ts` module exporting only the public surface (`assignVolumeNumbers` and `extractVolumeNumber`).

**Page sorting pipeline** (`src/lib/importer.ts:419–590`)
`detectCommonPrefix` → `parsePageSortKey` → `parseSegment` → `compareSortKeys` → `sortImageFiles` are five functions that operate together on filename strings. The `SortKey` type alias is private. This is a self-contained sorting algorithm that should be `src/lib/import/page-sorter.ts`.

**OCR dispatcher state machine** (`src/lib/ocr.ts:152–329`)
`nextDispatchable` selects a row; `processOnce` runs a 9-branch state machine over a `DispatchableRow`; `markFailed`, `markReady`, `markRunning` mutate DB state. These five functions operate on `DispatchableRow` data and collectively implement a job dispatcher. They should be a `OcrDispatcher` class or a `src/lib/ocr/dispatcher.ts` module with a clean public interface (`processNext(): Promise<string>`).

**Torrent scoring in monitor** (`src/lib/monitor.ts:25–53`)
`scoreTorrent` and `getMedianSize` are pure functions with no dependencies. They compute a single numeric score from a `TorrentResult`. Extracting them to `src/lib/manager/torrent-scorer.ts` would let them be unit-tested without mocking Deluge/Jackett.

**Import session store** (`src/lib/import-session.ts`)
The file uses `globalThis` to share session state across Next.js module instances, exposes raw `Partial<ImportSession>` updates via `updateSession`, and does filesystem cleanup inline. This is a stateful singleton that should expose a proper interface hiding the `globalThis` hack and the map internals.

**`buildCardBack` + `renderGlossaryHTML` + `renderStructuredHTML`** (`src/components/anki-card-dialog.tsx:719–813`)
95 lines of HTML serialization logic embedded inside a component file. These functions take a `TermHit` and produce an Anki card HTML string — a pure domain transformation. They belong in `src/lib/anki/card-template.ts` alongside `tag-template.ts`.

**Download history recording** (`src/app/api/import/progress/[importId]/route.ts:340–383` and `src/app/api/manager/manga/[id]/download/route.ts:69–100`)
Both route handlers insert `downloadHistory` records inline. The magnet-link name extraction, `decodeURIComponent`, and the insert are not abstracted. A `recordDownload(params)` function in a download-history module would centralize this.

---

## 8. Top Missing Modules

### Module 1: `src/lib/import/` — Import Pipeline

**Responsibilities it would own:**
- Filesystem discovery (`findImageFiles`, `findDirectImageFiles`, `findVolumeFolders`)
- Volume number parsing and assignment (`normalizeFolderName`, `extractVolumeNumber`, `extractVolumeNumberWithAncestors`, `assignVolumeNumbers`, `resolveDuplicate`, `parseBatchRange`)
- Page sorting (`detectCommonPrefix`, `parsePageSortKey`, `sortImageFiles`)
- File copy/move operations (`importVolume`, `importVolumeMove`, `getExistingVolumeNumbers`)
- Archive extraction (`extractIfNeeded`, `extractArchive`, `cleanupTempDir` from `extractor.ts`)
- Import session lifecycle (`createSession`, `getImportSession`, `updateSession`, `deleteSession`, `cleanupStaleSessions` from `import-session.ts`)
- Shared import types (`ImportAnalysis`, `DetectedVolume`, `ImportWarning` from `import-types.ts`)
- Title-from-path heuristic (`tryParseTitleFromPath`, currently inline in `analyze/route.ts:49`)

**Files that would move in:**
`src/lib/importer.ts` (split into `filesystem.ts`, `volume-numbering.ts`, `page-sorter.ts`, `volume-importer.ts`), `src/lib/extractor.ts`, `src/lib/import-session.ts`, `src/lib/import-types.ts`

**Why:** The import pipeline is the most complex domain in the app. It currently spreads across four `src/lib/` root files and bleeds into three route handlers. None of its public API is stable because callers import individual functions directly from `importer.ts`, which also exports background-task functions (`startBackgroundTasks`) that have nothing to do with importing. Separating the pipeline from the background task scheduler would make both independently testable.

---

### Module 2: `src/lib/download/` — Download Lifecycle

**Responsibilities it would own:**
- Polling Deluge for in-progress downloads (`updateDownloadProgress`, `updateBulkDownloadProgress`)
- Detecting completion and triggering import (`checkAndImportDownloads`, `checkAndImportBulkDownloads`)
- Abstracting the "single-volume vs. multi-volume" branching currently duplicated across those two functions
- Recording download history (`recordDownload` — new function to replace the inline inserts in `download/route.ts:69` and `progress/route.ts:355`)
- Magnet-link name extraction (the `/dn=([^&]+)/` pattern repeated in `monitor.ts:169` and `download/route.ts:71`)
- Background task registration for `download-progress` and `auto-import`

**Files that would move in:**
Lines 740–1409 of `src/lib/importer.ts` (the entire download monitoring and background-task section), the download-history insert logic from `src/app/api/manager/manga/[id]/download/route.ts` and `src/app/api/import/progress/[importId]/route.ts`

**Why:** Download lifecycle management is currently the largest unextracted concern in the codebase. The two import-check functions (`checkAndImportDownloads` and `checkAndImportBulkDownloads`) share ~80% structure but have no shared abstraction. A `DownloadLifecycle` module with a single `checkAndImport(mode: "single" | "bulk")` would collapse 450 lines to ~200 with no behavior change.

---

### Module 3: `src/lib/reader/` — Reader Domain

**Responsibilities it would own:**
- Library filesystem scanning (`syncLibrary`, `scanFilesystem` from `scanner.ts`)
- Image file path resolution (`getPagePath`, `getPageCount` from `image-resolver.ts`)
- Thumbnail generation (`getThumbnail`, `generateThumbnail` from `thumbnails.ts`)
- Cover caching (`getCoverPath`, `cacheCover` from `cover-cache.ts`)
- Filesystem path constants (`MANGA_DIR`) — exported once, imported by all
- `IMAGE_EXTENSIONS` constant — one canonical definition

**Files that would move in:**
`src/lib/scanner.ts`, `src/lib/image-resolver.ts`, `src/lib/thumbnails.ts`, `src/lib/cover-cache.ts`

**Why:** All four files operate on the same data (`MANGA_DIR`, `IMAGE_EXTENSIONS`, `volume.folderName`, `manga.folderName`) and are mutually related by the reader domain invariant (folder layout, page-file naming). They never appear without each other in any non-trivial feature. Centralising them eliminates seven independent `MANGA_DIR` constant declarations and six independent `IMAGE_EXTENSIONS` definitions.

---

### Module 4: `src/lib/shared/formatters.ts` — Formatting Utilities

**Responsibilities it would own:**
- `formatBytes(bytes: number): string` — one canonical implementation
- `formatSpeed(bytesPerSec: number): string` — one canonical implementation
- `formatTimeAgo(date: Date): string` — currently only in `manga-detail.tsx`
- `formatDuration(ms: number): string` — if needed

**Files that currently inline this:**
`src/lib/system/health-checks.ts:26`, `src/components/system/DiskUsage.tsx:14`, `src/components/system/ServiceCard.tsx:10`, `src/components/system/SystemAbout.tsx:23`, `src/components/dict-settings.tsx:242`, `src/workers/dict-worker.ts:60` (formatBytes); `src/components/manager/manga-detail.tsx:48`, `src/components/downloads-page.tsx:6`, `src/components/download-indicator.tsx:7`, `src/components/global-download-progress.tsx:6`, `src/components/system/ServiceCard.tsx:18` (formatSpeed)

**Why:** Eleven private copies of two functions, all identical. Any future change (e.g. locale-aware formatting) requires editing eleven files. This is the simplest possible refactor — extract once, import everywhere.

---

### Module 5: `src/lib/manager/` — Manager Domain Logic

**Responsibilities it would own:**
- Managed-manga title resolution: `resolveTitle(manga: { titleNative, titleRomaji, titleEnglish, anilistId }): string` — one function replacing six inline implementations with inconsistent fallback chains
- Torrent scoring: `scoreTorrent(result: TorrentResult, medianSize: number | null): number` and `getMedianSize(sizes: number[]): number | null` (currently in `monitor.ts:25–53`)
- Monitoring loop orchestration (`runMonitoringCycle`, `monitorSingleManga`, `refreshReleasingManga` from `monitor.ts`)
- Managed-volume status transitions (currently scattered across `download/route.ts`, `importer.ts`, and `monitor.ts` — each writing `db.update(managedVolume).set({ status: ... })` independently)
- Background task registration for `monitoring-cycle`

**Files that would consolidate into this:**
`src/lib/monitor.ts`, the title-resolution inline expressions from six call sites, the `scoreTorrent` + `getMedianSize` functions

**Why:** `resolveTitle` is the clearest example of a missing domain function. The three-way fallback `titleNative || titleRomaji || titleEnglish || ""` appears six times and is not even consistent (`importer.ts` skips `titleNative`). A typed `resolveTitle` function on a managed-manga value would be the single authoritative source.

---

## 9. Priority Ranking

1. **`src/lib/importer.ts` (1,409 lines) — split into import pipeline + download lifecycle**
   Highest-impact single change. Would reduce this file by ~670 lines, create the `src/lib/import/` and `src/lib/download/` modules, and eliminate the false dependency between "copy image files" and "poll Deluge." Every other import-related module currently imports from this one file, making the boundary invisible.

2. **`src/app/api/import/progress/[importId]/route.ts` (411 lines) — extract execution engine to a service**
   A route handler that is also the import execution engine prevents the import logic from being triggered from non-HTTP contexts (e.g. CLI, tests). Extracting `executeImport(config, analysis, signal)` as an async service function with an event emitter would reduce the route to under 50 lines.

3. **Missing `MANGA_DIR` / `IMAGE_EXTENSIONS` shared constants**
   Nine files each independently declare `MANGA_DIR`. Seven files each independently declare `IMAGE_EXTENSIONS`. Both should live in `src/lib/reader/constants.ts` or `src/config.ts`. This is a one-hour fix with zero behaviour change but eliminates the silent divergence risk.

4. **`src/components/anki-card-dialog.tsx` (817 lines) — split into dialog, definition panel, and card serializer**
   The `buildCardBack` function tree (lines 719–813) is domain logic that serializes a dictionary result to Anki HTML. It belongs in `src/lib/anki/card-template.ts`. The `DefinitionPanel` component (lines 283–423) should become its own file with a `useDefinitionLookup` hook. This reduces the dialog file to under 200 lines.

5. **Missing `formatBytes` / `formatSpeed` shared formatters**
   Eleven private copies across eleven files. Create `src/lib/shared/formatters.ts`, re-export from there, and replace all private definitions. The impact is low risk but the maintenance debt is real.

6. **`src/components/auth/account-settings.tsx` (645 lines, 23 hooks) — extract each section to its own file**
   `TwoFactorSection`, `PasskeySection`, `SessionsSection`, `ChangePasswordSection`, `ProfileSection` are each independently stateful features. Moving each to `src/components/auth/two-factor-section.tsx`, etc. would bring each file under 100 lines and make the account page composable.

7. **`src/lib/monitor.ts` — extract torrent scorer and separate from background timer**
   `scoreTorrent` and `getMedianSize` (lines 25–53) are pure functions that should be independently testable. The background timer (`startMonitorInterval`) is infrastructure that should be wired at startup, not baked into the domain module. Extract scorer to `src/lib/manager/torrent-scorer.ts`, timer setup to `src/lib/manager/monitor-task.ts`.

8. **`src/lib/system/service-checks.ts` — stop duplicating Deluge RPC**
   `delugeRpc` in `service-checks.ts` (lines 32–62) reimplements session/auth logic already owned by `src/lib/deluge.ts`. The check should call `deluge.ts`'s exported client rather than maintaining a separate stateless RPC path. This would also eliminate the divergence between "health check" and "actual" Deluge auth state.

9. **`resolveTitle` — extract managed-manga domain function**
   Six call sites, inconsistent fallback order between `importer.ts` and everywhere else. This is a five-minute extraction that removes a class of silent bugs.

10. **`src/app/api/import/analyze/route.ts` (356 lines) — extract analysis service**
    `tryParseTitleFromPath` (lines 49–76), the existing-volume page-count check (lines 192–220), and the per-volume warning generation (lines 267–296) are business logic embedded inside a route handler. Extracting `analyzeImportSource(sourcePath, sessionId?)` as a service would make the route under 50 lines and the analysis logic independently testable.
