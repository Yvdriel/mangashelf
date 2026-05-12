# MangaShelf Audit — Phase 1 Summary

Six scouts ran read-only against the entire repository. Findings below feed Phase 2 (standards doc + module restructure).

> **Corrections applied 2026-05-12 after Next.js docs fact-check:**
> - **`src/proxy.ts` is NOT dead.** Next.js 16 renamed the `middleware` file convention to `proxy` ([docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)). `next@16.1.6` is in `package.json`. File location, named `proxy` export, and `config` matcher all conform to the v16 contract. Edge auth IS running. Boundary, dead-code, and inconsistency scouts all flagged this incorrectly; their sections now carry retraction notes.
> - **`JUNK_DIRS` mismatch downgraded to LOW.** Extractor splits the constant into `JUNK_FILES` + `JUNK_DIRS`; `.DS_Store` IS cleaned via `JUNK_FILES`. Inconsistency scout missed the second set.
> - Other spot-checked claims (`surface-650` undefined, 10 import routes 403+"Unauthorized" body) — verified TRUE, no change.

---

## Per-scout summaries

### Modularity (PRIMARY)
`src/lib/importer.ts` (1,409 lines) fuses four concerns: filesystem traversal, volume-number parsing, file copying, and background-task orchestration; lines 740–1409 alone are the download-lifecycle subsystem misfiled inside the importer. `src/lib/` is a 20-file flat grab-bag with no domain grouping. The `/api/import/progress/[importId]/route.ts` SSE handler (411 lines) embeds the entire import execution engine inline. `src/components/anki-card-dialog.tsx` (817 lines) bundles UI, lookup logic, and Anki HTML serialisation in one file; `src/components/auth/account-settings.tsx` (645 lines, 23 hooks) bundles five independent feature sections. Highest-impact extraction: split `importer.ts` into `src/lib/import/` + `src/lib/download/`. See `modularity.md` Section 8 ("Top missing modules") — drives the Phase 2 module map below.

### Duplication
17 distinct clusters, ~350 estimated duplicated lines. Most severe: `MANGA_DIR` redeclared in 14 files (split between `./data/...` and `/data/...` defaults — silent dev-env bug); `IMAGE_EXTENSIONS` in 7; `formatBytes` in 6 (with `ServiceCard.tsx` using `.toFixed(1)` while siblings use `.toFixed(0)`); `formatSpeed`/`timeAgo` 4–5 copies; `parsePageNumber` in 3 (despite `image-resolver.ts` existing as the canonical home); torrent-completion predicate three times in same file (`importer.ts`); `clearBulkTorrent` DB update four times in same file. `checkAndImportDownloads` vs `checkAndImportBulkDownloads` share 80% structure with zero shared abstraction.

### Dead code
Few orphans overall. `src/db/types.ts` exports five aliases imported nowhere. `auth-schema.ts` at repo root is a Better Auth scaffold artifact orphaned by `src/db/schema.ts`. Unused exports: `getSqliteClient`, `getCachedCoverPath`, `findArchives`, `getActiveTorrents`, `searchTorrents`, `volumeFolderPath`, `mokuroFilePath`, deprecated `startImportInterval`. `src/lib/monitor.ts` has an `existingVolumes` query whose result is discarded plus an unreachable `getMedianSize` helper — leftover stubs for a deferred size-based scoring feature. (Earlier `src/proxy.ts` orphan claim retracted — it's a Next.js 16 framework entry point.)

### Slop
Three concentrations: (1) silent `catch {}` in mutation handlers (`manga-detail.tsx:138,161,183`; `manager-page.tsx:97,123,146,160`) drop user-visible errors on the floor; (2) `formatBytes` copy-pasted six times with subtle behavioural drift; (3) `globalThis as unknown as` type-escape repeated in four files. Notable React anti-patterns: `download-status.tsx:167` wraps the context value in `useCallback` then immediately calls it (defeats memoisation, breaks Provider re-render avoidance); `ServiceCard.tsx:44` syncs derived state via `useEffect` (two-render flicker); `StatusPage.tsx` is wholesale `'use client'` including pure-presentational `DiskUsage` / `StatsGrid`; `.then()` chains mixed with `await` in `reader.tsx` and `settings.tsx`. N+1 query in `/api/manager/manga` GET (one volume query per manga). Always-`single_manga` ternary in `analyze/route.ts:300`.

### Inconsistencies
Single-framework codebase, no library drift (one HTTP client, one ORM, one state mechanism). Worst issues are env-var/constant duplication (`MANGA_DIR` ×14, `IMAGE_EXTENSIONS` ×7, `DATABASE_URL` split between `./data/...` and `/data/...`). `JUNK_DIRS` shapes differ between `extractor.ts` (file/dir split, with `.ds_store` in `JUNK_FILES`) and `importer.ts` (single dir set including `.ds_store`) — divergent shape but both clean `.DS_Store` correctly (original "survives extraction" claim retracted). All 10 import-domain routes return `{ error: "Unauthorized" }` with HTTP 403 (semantic inverse). Component files: kebab-case everywhere except `components/system/` which is PascalCase. `/api/manga` + `/api/manga/[id]` duplicate the aggregation logic that the corresponding server components already compute (dead REST layer). `passkey.createdAt` is `timestamp_ms` while all sibling columns are `timestamp`. `surface-650` Tailwind class used in `downloads-page.tsx` is undefined.

### Boundaries
No circular dependencies, no barrel-file abuse, no runtime server→client leaks. Edge auth IS running via `src/proxy.ts` (Next.js 16 file convention). Reader/Manager domains coupled at DB layer: `src/app/page.tsx` and `src/app/manga/[id]/page.tsx` query Manager tables (`managedManga`, `managedVolume`) directly. `/api/delete` and `/api/downloads/status` bridge domains while living in the Reader namespace. No `import 'server-only'` guards on any server module — one mis-imported value-import away from a client-bundle leak. `ocr-overlay.tsx` re-exports types from `@/lib/mokuro` (uses `fs` + `@/db`); safe today only because all consumers use `import type`.

---

## Consolidated Top-10 Priority List

Ranked by structural impact + risk. Numbers in parens reference each scout's own priority.

1. **`src/lib/importer.ts` (1,409 lines) — split into import pipeline + download lifecycle.** (Modularity #1.) Highest-impact single refactor. Lines 740–1409 are download lifecycle; extract to `src/lib/download/`. The rest splits into `filesystem.ts` + `volume-numbering.ts` + `page-sorter.ts` + `volume-importer.ts` under `src/lib/import/`.

2. **`MANGA_DIR` / `IMAGE_EXTENSIONS` / `DATABASE_URL` redeclared everywhere.** (Duplication #1–2, Inconsistency #1, Modularity #3.) 14 / 7 / 5 separate declarations. `DATABASE_URL` split between `./data/...` and `/data/...` is a latent dev-env bug. Create `src/lib/shared/constants.ts`; one canonical source per constant. (`JUNK_DIRS` mismatch downgraded to LOW after fact-check — both files clean `.DS_Store` correctly via different mechanisms; only shape diverges.)

3. **`src/app/api/import/progress/[importId]/route.ts` (411 lines) is the import execution engine in a route handler.** (Modularity #2.) Extract `executeImport(config, analysis, signal)` to a service; route shrinks to ≤50 lines. Enables non-HTTP triggers (CLI, tests) and isolates SSE wiring from import logic.

4. **`formatBytes` / `formatSpeed` / `timeAgo` duplicated 6 / 5 / 4 times with subtle behavioural drift.** (Slop #2, Duplication #3–4, Modularity #5.) Trivial extraction to `src/lib/shared/formatters.ts`. The `ServiceCard.tsx` `.toFixed(1)` vs siblings' `.toFixed(0)` divergence is a real UI inconsistency; `DiskUsage`'s `bytes <= 0` guard is a latent bug elsewhere.

5. **`src/components/anki-card-dialog.tsx` (817 lines) — split into dialog / definition panel / card serializer.** (Modularity #4.) `buildCardBack`/`renderGlossaryHTML`/`renderStructuredHTML` (lines 719–813) are pure domain logic; move to `src/lib/anki/card-template.ts`. `DefinitionPanel` becomes its own file + `useDefinitionLookup` hook.

6. **Reader pages query Manager tables directly (`src/app/page.tsx`, `src/app/manga/[id]/page.tsx`).** (Boundary #3–4.) Schema changes in Manager silently break Reader. Introduce `src/lib/bridge/` (or expose narrow query functions in `src/lib/manager/`) so the cross-domain seam is explicit and testable.

7. **Silent `catch {}` in manager mutation handlers + 10 import routes returning `{ error: "Unauthorized" }` with HTTP 403.** (Slop #7, Inconsistency #3.) User-visible mutation failures are invisible; auth response body contradicts status. Add `toast.error` + correct response body shapes. Centralise on `NextResponse.json({ error })` (current outliers: plain-text bodies in 3 routes, raw `Response.json` in 1).

8. **`/api/manga` + `/api/manga/[id]` REST routes duplicate the server-component aggregation (`completedVolumes`, `progressPercent`, `lastReadAt`).** (Inconsistency #6, Duplication #15.) Either retire them (no callers found) or extract the aggregation into `src/lib/reader/library-queries.ts` so both paths share one implementation.

9. **`src/components/auth/account-settings.tsx` (645 lines, 23 hooks) — extract each section to its own file.** (Modularity #6.) `TwoFactorSection`, `PasskeySection`, `SessionsSection`, `ChangePasswordSection`, `ProfileSection` are independently stateful features. Each <100 lines after extraction. Establishes the pattern for other God components (`manga-detail.tsx`, `manager-page.tsx`, `StatusPage.tsx`).

10. **No `import 'server-only'` guards on any server-only module.** (Boundary #1.) DB, scanner, importer, monitor, deluge, jackett, auth, extractor, ocr — none of them. Compile-time protection against future client-bundle leaks is missing. Add `import 'server-only';` as the first line of each.

---

## Proposed Phase 2 Module Structure

Derived from `modularity.md` Section 8 ("Top missing modules") with cross-references from duplication/boundary/inconsistency findings.

### `src/lib/` reorganisation

```
src/lib/
├── shared/                          ← NEW
│   ├── constants.ts                 ← MANGA_DIR, IMAGE_EXTENSIONS, DOWNLOAD_DIR, DATABASE_URL, JUNK_DIRS
│   └── formatters.ts                ← formatBytes, formatSpeed, formatTimeAgo, formatDuration
│
├── import/                          ← NEW (extracted from importer.ts + extractor.ts + import-session.ts + import-types.ts)
│   ├── filesystem.ts                ← findImageFiles, findVolumeFolders, findDirectImageFiles
│   ├── volume-numbering.ts          ← normalizeFolderName, extractVolumeNumber, assignVolumeNumbers, resolveDuplicate, parseBatchRange
│   ├── page-sorter.ts               ← detectCommonPrefix, parsePageSortKey, sortImageFiles, compareSortKeys
│   ├── volume-importer.ts           ← importVolume, importVolumeMove (with shared _prepareImport helper)
│   ├── extractor.ts                 ← extractIfNeeded, extractArchive, cleanupTempDir
│   ├── session.ts                   ← createSession, getImportSession, updateSession, deleteSession
│   ├── analysis.ts                  ← analyzeImportSource, tryParseTitleFromPath (extracted from analyze/route.ts)
│   ├── execution.ts                 ← executeImport(config, analysis, signal) (extracted from progress/route.ts)
│   └── types.ts                     ← ImportAnalysis, DetectedVolume, ImportWarning
│
├── download/                        ← NEW (extracted from importer.ts:740–1409)
│   ├── progress.ts                  ← updateDownloadProgress, updateBulkDownloadProgress
│   ├── auto-import.ts               ← checkAndImportDownloads + Bulk (collapsed via shared abstraction)
│   ├── history.ts                   ← recordDownload (extracted from 3 inline inserts)
│   ├── magnet.ts                    ← extractTorrentName, isTorrentComplete
│   └── tasks.ts                     ← background-task registration for download-progress + auto-import
│
├── reader/                          ← NEW (extracted from scanner.ts + image-resolver.ts + thumbnails.ts + cover-cache.ts)
│   ├── scanner.ts                   ← syncLibrary, scanFilesystem
│   ├── image-resolver.ts            ← getPagePath, parsePageNumber (canonical home)
│   ├── thumbnails.ts                ← getThumbnail, generateThumbnail
│   ├── covers.ts                    ← getCachedCover (drop unused getCachedCoverPath)
│   └── library-queries.ts           ← getLibraryListing, getMangaDetailWithProgress (extracted from server pages + dead /api/manga routes)
│
├── manager/                         ← NEW (extracted from monitor.ts + 6 inline title-chain sites + scattered DB writes)
│   ├── monitor.ts                   ← runMonitoringCycle, monitorSingleManga, refreshReleasingManga
│   ├── torrent-scorer.ts            ← scoreTorrent (pure, unit-testable)
│   ├── titles.ts                    ← resolveTitle (one canonical fallback chain, replaces 6 inline copies)
│   ├── parse-row.ts                 ← parseManagedManga (handles synonyms/genres JSON.parse used in 7 sites)
│   ├── volume-status.ts             ← managed-volume status transitions (consolidates scattered .update().set({ status }))
│   └── tasks.ts                     ← monitoring-cycle background task registration
│
├── ocr/                             ← NEW (extracted from ocr.ts + mokuro.ts + mokuro-client.ts)
│   ├── queue.ts                     ← enqueueVolumeOcr, enqueueOcrForManga (public API)
│   ├── dispatcher.ts                ← processOnce state machine, markRunning/Ready/Failed, nextDispatchable
│   ├── queries.ts                   ← getMangaOcrSummary, getVolumeOcrStatuses, resolveMokuroFile (read-model)
│   ├── client.ts                    ← Mokuro HTTP client
│   ├── paths.ts                     ← volumeFolderPath, mokuroFilePath (no longer exported widely)
│   ├── types.ts                     ← MokuroBlock, MokuroPage, MokuroFile (pure types — fixes ocr-overlay re-export fragility)
│   └── tasks.ts                     ← OCR dispatcher background task registration
│
├── integrations/                    ← NEW (extracted from anilist.ts + jackett.ts + deluge.ts)
│   ├── anilist.ts                   ← AniList GraphQL client
│   ├── jackett.ts                   ← Jackett search (un-export searchTorrents)
│   └── deluge.ts                    ← Deluge RPC + DELUGE_URL/PASSWORD exports (consumed by service-checks.ts to kill duplication)
│
├── auth/                            ← NEW (group existing files)
│   ├── server.ts                    ← BetterAuth config (was auth.ts)
│   ├── client.ts                    ← (was auth-client.ts; drop dead named re-exports)
│   └── helpers.ts                   ← getSession, requireAdmin (was auth-helpers.ts)
│
├── anki/                            ← NEW
│   ├── card-template.ts             ← buildCardBack, renderGlossaryHTML, renderStructuredHTML (extracted from anki-card-dialog.tsx)
│   └── client.ts                    ← (existing)
│
├── system/                          ← keep existing structure; tighten
│   ├── health-checks.ts             ← decompose 335-line runHealthChecks into category functions
│   ├── service-checks.ts            ← use lib/integrations/deluge.ts (kill duplicate DELUGE_URL/RPC)
│   ├── db-stats.ts                  ← collapse 11 queries into 2 (COUNT CASE WHEN)
│   ├── disk.ts
│   └── system-info.ts
│
├── background/
│   └── task-registry.ts             ← consolidate globalThis cast via shared global declaration
│
├── global-state.ts                  ← NEW (declare global { var __mangashelf_*: ... }) — kills 4× `as unknown as` casts
│
└── api.ts                           ← (keep — small client-side helper)
```

### `src/components/` reorganisation

```
src/components/
├── reader/         ← reader.tsx, ocr-overlay.tsx, ocr-manga-button.tsx, reader-settings.tsx, copy-handler.tsx
├── library/        ← library-filter.tsx, manga-card.tsx, manga-description.tsx
├── manager/        ← (exists) split manga-detail.tsx into sub-components
├── downloads/      ← download-indicator.tsx, downloads-page.tsx, global-download-progress.tsx
├── import/         ← (exists)
├── anki/           ← anki-card-dialog.tsx (split: dialog, definition-panel, token-stream, glossary), anki-settings.tsx
├── settings/       ← text-tools-settings.tsx, dict-settings.tsx
├── auth/           ← (exists) add user-menu.tsx; split account-settings.tsx into profile/password/two-factor/passkey/sessions
├── system/         ← (exists) RENAME files to kebab-case (status-page.tsx, health-badge.tsx, etc.); add 'use client' only where genuinely interactive
└── ui/             ← confirm-dialog.tsx, selection-bar.tsx, logo.tsx, nav.tsx, themed-toaster.tsx, sw-register.tsx, theme-picker.tsx
```

### `src/app/api/` adjustments

- **Delete** `/api/manga` + `/api/manga/[id]` (no callers — dead REST layer).
- **Delete** `/api/system/health` or proxy it to `/api/system/status` (parallel duplicate).
- **Move** `/api/delete` → `/api/library/delete` (Reader/Manager bridge, clearer namespace).
- **Move** `/api/downloads/status` → `/api/manager/status/downloads`.
- Standardise auth-error responses: `getSession` → 401 `{ error: "Unauthorized" }`; `requireAdmin` → 403 `{ error: "Forbidden" }`. Eliminate plain-text `new Response(...)` bodies.

### Cross-cutting Phase 2 standards (for the standards doc)

Derived from inconsistency + slop + boundary findings:

1. One canonical module per concern; no inline env-var fallbacks anywhere outside `src/lib/shared/constants.ts`.
2. Every server-only module starts with `import 'server-only';`.
3. Pure types live in `*-types.ts` modules with zero `fs` / `db` / `process` imports — safe to re-export from client.
4. Route handlers: validate → delegate → respond. Business logic lives in `src/lib/*/`.
5. `NextResponse.json({ error }, { status })` for all error responses; never plain text.
6. Component files: kebab-case. `'use client'` only where the component genuinely needs browser APIs / event handlers / hooks.
7. Derived state computed inline; no `useEffect` for prop-sync.
8. Mutation handlers surface failures via toast; no silent `catch {}`.
9. Drizzle `Partial<InferInsertModel<typeof table>>` for update accumulators, not `Record<string, unknown>`.
10. Background tasks register via `task-registry`; do not start ad-hoc `setInterval` in module scope.

---

## File index

- `audit/modularity.md` — primary
- `audit/duplication.md`
- `audit/dead-code.md`
- `audit/slop.md`
- `audit/inconsistencies.md`
- `audit/boundaries.md`
