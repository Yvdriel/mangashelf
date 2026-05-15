# Duplication audit

## Summary

The MangaShelf codebase contains 17 distinct duplication clusters spanning API routes, library modules, and React components. The most severe issues are: (1) `parsePageNumber` + image-file listing logic copied verbatim across three files without re-using the already-extracted `image-resolver.ts`; (2) `IMAGE_EXTENSIONS` and `MANGA_DIR` constants redeclared in 8–14 files apiece instead of living in a shared `src/lib/constants.ts`; (3) `formatSpeed` / `formatBytes` / `timeAgo` utility functions copy-pasted into 4–6 component files; (4) a "find-or-create `managedManga` from AniList" block duplicated between the POST `/api/manager/manga` route and the import progress SSE route; and (5) the torrent-completion predicate (`state === "Seeding" || (state === "Paused" && progress === 100)`) repeated three times inside `importer.ts`. Estimated total duplicated lines: ~350.

---

## Exact duplicates

### 1. `parsePageNumber` function — three identical copies

**Locations:**
- `/Users/yoran/mangashelf/src/lib/scanner.ts:L43-L47`
- `/Users/yoran/mangashelf/src/lib/image-resolver.ts:L17-L21`
- `/Users/yoran/mangashelf/src/app/api/manga/[id]/volume/[volumeNumber]/pages/route.ts:L12-L16`

**Pattern:** Each file defines the same `parsePageNumber(filename: string): number` function with identical bodies:
```ts
const name = path.parse(filename).name;
const stripped = name.replace(/^_+/, "");
return parseInt(stripped, 10);
```
`image-resolver.ts` was clearly created to centralise this logic but `scanner.ts` and the pages route were never updated to import from it.

**Recommendation:** Move `parsePageNumber` into `image-resolver.ts` (or a dedicated `src/lib/page-utils.ts`) and export it. The pages route already imports `resolvePageImage` from `image-resolver`; scanner can import from the same place.

---

### 2. `IMAGE_EXTENSIONS` constant — 8 independent declarations

**Locations:**
- `/Users/yoran/mangashelf/src/lib/scanner.ts:L25`
- `/Users/yoran/mangashelf/src/lib/importer.ts:L30`
- `/Users/yoran/mangashelf/src/lib/image-resolver.ts:L8`
- `/Users/yoran/mangashelf/src/app/api/manga/[id]/volume/[volumeNumber]/pages/route.ts:L10`
- `/Users/yoran/mangashelf/src/app/api/import/analyze/route.ts:L29`
- `/Users/yoran/mangashelf/src/app/api/import/preview/[sessionId]/[volumeIndex]/[pageIndex]/route.ts:L10`
- `/Users/yoran/mangashelf/src/app/api/import/browse/route.ts:L10`

**Pattern:** `const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);` — identical set in all 7 places (8 occurrences counting both scanner and importer).

**Recommendation:** Export from `src/lib/image-resolver.ts` (already the natural home) or a `src/lib/constants.ts`. All seven files import it from one source.

---

### 3. `MANGA_DIR` process.env fallback — 14 independent declarations

**Locations:**
- `/Users/yoran/mangashelf/src/lib/scanner.ts:L14`
- `/Users/yoran/mangashelf/src/lib/importer.ts:L26`
- `/Users/yoran/mangashelf/src/lib/image-resolver.ts:L7`
- `/Users/yoran/mangashelf/src/lib/thumbnails.ts:L6`
- `/Users/yoran/mangashelf/src/lib/ocr.ts:L15`
- `/Users/yoran/mangashelf/src/lib/cover-cache.ts:L4`
- `/Users/yoran/mangashelf/src/lib/system/disk.ts:L9`
- `/Users/yoran/mangashelf/src/lib/system/health-checks.ts:L23`
- `/Users/yoran/mangashelf/src/lib/system/system-info.ts:L60` (inside function body)
- `/Users/yoran/mangashelf/src/app/api/delete/route.ts:L9`
- `/Users/yoran/mangashelf/src/app/api/manga/[id]/volume/[volumeNumber]/pages/route.ts:L9`
- `/Users/yoran/mangashelf/src/app/api/import/progress/[importId]/route.ts:L25`
- `/Users/yoran/mangashelf/src/app/api/import/analyze/route.ts:L27`
- `/Users/yoran/mangashelf/src/app/api/import/browse/route.ts:L9`

**Pattern:** `const MANGA_DIR = process.env.MANGA_DIR || "/manga";` — identical string in 14 files.

**Recommendation:** Export `MANGA_DIR` from `src/lib/constants.ts` (or from `src/lib/image-resolver.ts` which already handles it). Changing the default path currently requires touching 14 files.

---

### 4. `formatSpeed` function — 4 identical or near-identical copies

**Locations:**
- `/Users/yoran/mangashelf/src/components/downloads-page.tsx:L6-L11`
- `/Users/yoran/mangashelf/src/components/download-indicator.tsx:L7-L12`
- `/Users/yoran/mangashelf/src/components/global-download-progress.tsx:L6-L11`
- `/Users/yoran/mangashelf/src/components/manager/manga-detail.tsx:L48-L53`
- `/Users/yoran/mangashelf/src/components/system/ServiceCard.tsx:L18-L23` (uses `.toFixed(1)` instead of `.toFixed(0)` for KB/s — one digit differs)

**Pattern:** Three-tier byte-rate formatter (`B/s`, `KB/s`, `MB/s`) copy-pasted into every component that shows download speed.

**Recommendation:** Extract to `src/lib/format.ts` and import. Minor: `ServiceCard` uses `.toFixed(1)` for KB; the others use `.toFixed(0)` — unify at extraction time.

---

### 5. `timeAgo` / `formatTimeAgo` function — 4 near-identical copies

**Locations:**
- `/Users/yoran/mangashelf/src/components/downloads-page.tsx:L13-L19` (accepts `string`)
- `/Users/yoran/mangashelf/src/components/download-indicator.tsx:L14-L20` (accepts `string`, identical body)
- `/Users/yoran/mangashelf/src/components/manager/manga-detail.tsx:L55-L63` (`formatTimeAgo`, accepts `Date`, includes a `d ago` branch)
- `/Users/yoran/mangashelf/src/components/import/import-history.tsx:L39-L46` (accepts `string`, identical to downloads-page version)

**Pattern:** Relative-time formatter. The `manga-detail` version adds a "days" tier; all others stop at hours.

**Recommendation:** Extract to `src/lib/format.ts` with the fuller `d ago` branch enabled for all callers.

---

### 6. `formatBytes` function — 6 copies

**Locations:**
- `/Users/yoran/mangashelf/src/components/system/ServiceCard.tsx:L10-L16`
- `/Users/yoran/mangashelf/src/components/system/SystemAbout.tsx:L23-L29`
- `/Users/yoran/mangashelf/src/components/system/DiskUsage.tsx:L14-L20`
- `/Users/yoran/mangashelf/src/lib/system/health-checks.ts:L26-L31`
- `/Users/yoran/mangashelf/src/components/dict-settings.tsx:L242-L247`
- `/Users/yoran/mangashelf/src/workers/dict-worker.ts:L60-L64` (worker-side variant, same logic)

**Pattern:** Four-tier byte formatter (B, KB, MB, GB). Identical four-branch logic in every file. `health-checks.ts` and the components each define their own private copy.

**Recommendation:** Extract to `src/lib/format.ts`. The worker file would import from a shared location too (it's already a web worker so it can import from `@/lib/format`).

---

### 7. `calcDirSize` / `calculateDirSize` — 2 independent implementations

**Locations:**
- `/Users/yoran/mangashelf/src/lib/system/disk.ts:L38-L59` (`calcDirSize` — skips dotfiles)
- `/Users/yoran/mangashelf/src/app/api/import/analyze/route.ts:L31-L47` (`calculateDirSize` — counts all files, ignores permissions errors slightly differently)

**Pattern:** Both recursively sum `fs.statSync().size` for all files under a directory. Minor differences: `disk.ts` skips `entry.name.startsWith(".")` entries and catches individual file stat errors separately; `analyze/route.ts` catches the whole directory iteration in one try/catch.

**Recommendation:** Extract to `src/lib/fs-utils.ts` with the stricter (dotfile-skipping) variant as the default. Pass the dotfile-skip as a parameter if both behaviours are needed.

---

### 8. Torrent completion predicate — 3 copies inside `importer.ts`

**Locations:**
- `/Users/yoran/mangashelf/src/lib/importer.ts:L757-L758` (inside `updateDownloadProgress`)
- `/Users/yoran/mangashelf/src/lib/importer.ts:L868-L869` (inside `checkAndImportBulkDownloads`)
- `/Users/yoran/mangashelf/src/lib/importer.ts:L1077-L1078` (inside `checkAndImportDownloads`)

**Pattern:**
```ts
const isComplete =
  status.state === "Seeding" ||
  (status.state === "Paused" && status.progress === 100);
```
The exact two-line expression is copy-pasted three times in the same file.

**Recommendation:** Extract as `function isTorrentComplete(status: TorrentStatus): boolean` at the top of `importer.ts`.

---

### 9. `clearBulkTorrent` DB update — 4 copies in `importer.ts`

**Locations:**
- `/Users/yoran/mangashelf/src/lib/importer.ts:L883-L891`
- `/Users/yoran/mangashelf/src/lib/importer.ts:L906-L914`
- `/Users/yoran/mangashelf/src/lib/importer.ts:L999-L1007`
- `/Users/yoran/mangashelf/src/lib/importer.ts:L1018-L1026`

**Pattern:** Four identical Drizzle `db.update(managedManga).set({ bulkTorrentId: null, bulkProgress: 0, bulkDownloadSpeed: 0, updatedAt: new Date() }).where(eq(managedManga.id, manga.id)).run()` blocks.

**Recommendation:** Extract as `function clearBulkTorrent(mangaId: number): void` inside `importer.ts`.

---

## Near-duplicates

### 10. `db.insert(managedManga)` from AniList detail — 2 near-identical blocks

**Locations:**
- `/Users/yoran/mangashelf/src/app/api/manager/manga/route.ts:L80-L114` (POST, always inserts, then bulk-creates missing volumes)
- `/Users/yoran/mangashelf/src/app/api/import/progress/[importId]/route.ts:L268-L297` (conditional insert inside SSE handler, also creates managed volumes in a second pass)

**What's shared:** Both call `getMangaDetail(anilistId)` and then run an identical 10-field `db.insert(managedManga).values({...})` block. The `import/progress` route adds `monitored: config.monitor` and omits the bulk volume-creation loop.

**What differs:** The `route.ts` version creates all volumes immediately for the known `detail.volumes` count; the progress route creates/updates only the volumes actually being imported.

**Recommendation:** Extract a `createManagedMangaFromAniList(anilistId, opts?)` helper in `src/lib/manager-helpers.ts`. Each caller passes a flag for whether to pre-populate volumes.

---

### 11. `synonyms` / `genres` JSON parse — 7 near-identical expressions

**Locations:**
- `/Users/yoran/mangashelf/src/app/api/manager/manga/route.ts:L37-L38`
- `/Users/yoran/mangashelf/src/app/api/manager/manga/[id]/route.ts:L38-L39`
- `/Users/yoran/mangashelf/src/app/api/manager/manga/[id]/search/route.ts:L37-L38`
- `/Users/yoran/mangashelf/src/lib/monitor.ts:L90`
- `/Users/yoran/mangashelf/src/app/manager/[id]/page.tsx:L57-L58`
- `/Users/yoran/mangashelf/src/app/page.tsx:L83`
- `/Users/yoran/mangashelf/src/app/manga/[id]/page.tsx:L50`

**Pattern:** `JSON.parse(m.synonyms || "[]")` / `JSON.parse(m.genres || "[]")` — two or three of these appear at every call site that touches a `managedManga` row.

**Recommendation:** Add a `parseManagedManga(row)` helper that returns the row with `synonyms` and `genres` already parsed. This is a natural fit in `src/db/types.ts` or a `src/lib/manager-helpers.ts`.

---

### 12. Title resolution fallback chain — 4 near-identical expressions

**Locations:**
- `/Users/yoran/mangashelf/src/lib/monitor.ts:L89` — `manga.titleNative || manga.titleRomaji || manga.titleEnglish || ""`
- `/Users/yoran/mangashelf/src/app/api/downloads/status/route.ts:L82` — same
- `/Users/yoran/mangashelf/src/components/manager/manager-page.tsx:L77` — same
- `/Users/yoran/mangashelf/src/components/manager/manga-detail.tsx:L117` — same
- `/Users/yoran/mangashelf/src/lib/importer.ts:L873` and `L1110` — `manga.titleRomaji || manga.titleEnglish || \`Manga ${manga.anilistId}\`` (different order, different final fallback)

**What differs:** `importer.ts` uses romaji-first and falls back to `"Manga N"`; other sites use native-first and fall back to `""`.

**Recommendation:** Define `getMangaDisplayTitle(m)` and `getMangaImportTitle(m)` in a shared utility, making the different fallback strategies explicit and discoverable.

---

### 13. Torrent-name extraction from magnet link — 2 copies

**Locations:**
- `/Users/yoran/mangashelf/src/app/api/manager/manga/[id]/download/route.ts:L71-L72`
- `/Users/yoran/mangashelf/src/lib/monitor.ts:L169-L170`

**Pattern:**
```ts
magnetLink.match(/dn=([^&]+)/)?.[1]?.replace(/\+/g, " ") || fallback
```
Identical regex-plus-decode expression for extracting a human-readable torrent name from a magnet URI.

**Recommendation:** Extract `extractTorrentName(magnetLink: string, fallback?: string): string` in `src/lib/deluge.ts` or a new `src/lib/magnet.ts`.

---

### 14. Magnet-link JSON parse for `synonyms` used in Jackett search — 2 near-identical call sites

**Locations:**
- `/Users/yoran/mangashelf/src/app/api/manager/manga/[id]/search/route.ts:L33-L39`
- `/Users/yoran/mangashelf/src/lib/monitor.ts:L116-L123`

**Pattern:** Both fetch the `managedManga` row, parse `synonyms`, and pass `{ native, romaji, synonyms }` to `searchMangaVolumes()`. The shape of the object is identical.

**Recommendation:** Extract a `getMangaTitles(mangaId)` helper that returns the parsed title bag, or move the synonyms parsing into `searchMangaVolumes` itself.

---

## Structural duplication

### 15. Reader vs Manager "list + per-item aggregation" API routes

**Locations:**
- `/Users/yoran/mangashelf/src/app/api/manga/route.ts:L9-L55` — iterates `allManga`, inner-loops `volume` + `readingProgress` per manga
- `/Users/yoran/mangashelf/src/app/api/manager/manga/route.ts:L10-L47` — iterates `allMangaManaged`, inner-loops `managedVolume` per manga to compute `importedCount`, `downloadingCount`, `missingCount`

**Shared structure:** Both do a top-level `db.select().from(table).all()` then map over results with per-item N+1 queries to build an enriched response object. Neither uses a JOIN.

**Recommendation:** Leave as is for now (the domains are genuinely different), but document the N+1 pattern as a future performance target. If the library grows to hundreds of manga the queries should be converted to JOINs or CTEs.

---

### 16. Parallel `system/health` vs `system/status` route

**Locations:**
- `/Users/yoran/mangashelf/src/app/api/system/health/route.ts:L1-L47`
- `/Users/yoran/mangashelf/src/app/api/system/status/route.ts:L1-L63`

**Shared structure:** Both routes call the exact same set of functions: `checkAllServices`, `checkForUpdates`, `getLibraryDiskInfo`, `getDatabaseInfo`, `getStagingInfo`, `getDatabaseStats`, `runHealthChecks`. The only additions in `status` are `getTaskStates` and `getSystemInfo`. The first 30 lines of each handler are near-identical.

**Recommendation:** Delete `/api/system/health` entirely or have it call `/api/system/status` internally. The health route was likely created as a lightweight variant but now does almost the same work.

---

### 17. `importVolume` vs `importVolumeMove` — two 50-line near-copies

**Locations:**
- `/Users/yoran/mangashelf/src/lib/importer.ts:L596-L643` (`importVolume` — copy semantics)
- `/Users/yoran/mangashelf/src/lib/importer.ts:L650-L713` (`importVolumeMove` — rename/copy-delete semantics)

**Shared structure:** Both functions have an identical preamble (lines 1–10 of each): `volLabel` construction, `targetDir` path, existence check, `findImageFiles`, `sortImageFiles`, `mkdirSync`, `padWidth` calculation. They only diverge in the per-file operation (`copyFileSync` vs `renameSync` with cross-device fallback).

**Recommendation:** Extract the common setup into a private `_prepareImport(sourcePath, mangaTitle, anilistId, volumeNumber)` helper that returns `{ targetDir, sorted, padWidth }`, and call it from both functions.

---

## Suggested extractions

| # | Proposed module | Callers it would replace |
|---|---|---|
| 1 | `src/lib/constants.ts` — exports `MANGA_DIR`, `IMAGE_EXTENSIONS` | 14 files for `MANGA_DIR`; 7 files for `IMAGE_EXTENSIONS` |
| 2 | `src/lib/format.ts` — exports `formatSpeed`, `formatBytes`, `timeAgo` | 5 × `formatSpeed`, 6 × `formatBytes`, 4 × `timeAgo` |
| 3 | `parsePageNumber` moved to `src/lib/image-resolver.ts` (exported) | `scanner.ts`, pages route |
| 4 | `src/lib/manager-helpers.ts` — `createManagedMangaFromAniList`, `parseManagedManga`, `getMangaTitles` | 2 insert blocks, 7 JSON.parse sites, 4 title-chain sites |
| 5 | `isTorrentComplete(status)` — private helper in `importer.ts` | 3 inline copies in same file |
| 6 | `clearBulkTorrent(mangaId)` — private helper in `importer.ts` | 4 inline copies in same file |
| 7 | `extractTorrentName(magnetLink, fallback)` — in `src/lib/deluge.ts` | `download/route.ts`, `monitor.ts` |
| 8 | `_prepareImport(...)` — private helper in `importer.ts` | `importVolume`, `importVolumeMove` |
| 9 | Delete `src/app/api/system/health/route.ts` or proxy to `status` | Removes duplicate service-check execution |

---

## Priority ranking (top 10 by impact)

| Rank | Cluster | Files | Est. dup. lines | Impact |
|---|---|---|---|---|
| 1 | `MANGA_DIR` constant — 14 independent declarations | 14 | ~14 | High: changing default or env name requires touching 14 files; currently `system-info.ts` defines it inside a function body (inconsistent). |
| 2 | `IMAGE_EXTENSIONS` constant — 8 declarations | 8 | ~8 | High: one file adding `.avif` support won't propagate. |
| 3 | `formatBytes` — 6 copies | 6 | ~30 | High: 6 UI/lib files with private copies; `ServiceCard` uses `.toFixed(1)` for KB while others use `.toFixed(0)`, a silent inconsistency. |
| 4 | `formatSpeed` — 5 copies; `timeAgo` — 4 copies | 5+4 | ~40 | High: download speed display is inconsistent (KB rounding) across components. |
| 5 | `db.insert(managedManga)` from AniList — 2 near-duplicate blocks | 2 | ~25 | High: adding a new metadata field (e.g. `startDate`) requires updating both blocks independently. |
| 6 | `synonyms` / `genres` JSON parse — 7 sites | 7 | ~14 | Medium: every new API or page that reads `managedManga` must remember to parse these two columns. |
| 7 | `importVolume` vs `importVolumeMove` preamble — 50-line near-copy | 1 file, 2 functions | ~50 | Medium: bugs in the common setup (e.g. the `existsSync` guard) must be fixed twice. |
| 8 | `clearBulkTorrent` update block — 4 copies in `importer.ts` | 1 file | ~32 | Medium: error-recovery paths in one block were patched without updating the others (compare L885–891 vs L906–914). |
| 9 | `parsePageNumber` — 3 copies | 3 | ~12 | Medium: the underscore-stripping logic (`/^_+/`) is in two places that haven't adopted the importer's more sophisticated `sortImageFiles`. |
| 10 | `system/health` vs `system/status` API routes — parallel service-check invocations | 2 routes | ~20 | Low-Medium: double the external HTTP calls (to Deluge, Jackett, AniList) if both routes are called in the same request cycle; misleading separation suggests a maintenance contract that doesn't exist. |
