# Inconsistency Audit — MangaShelf

## Summary

MangaShelf is a well-structured, single-framework codebase (Next.js 16 App Router only, no Pages Router contamination) with no third-party HTTP or state-management libraries beyond what is already embedded in the stack. The inconsistencies that exist are almost entirely the result of organic growth across two domains (Reader and Manager) and incremental feature additions. The most costly patterns to maintain are: (1) eight separate files each re-declaring `IMAGE_EXTENSIONS` and `MANGA_DIR` instead of sharing them from a single constants module; (2) the entire `/api/manga*` REST layer duplicating DB query logic that is already executed synchronously in server components; (3) a pervasive auth error response mismatch where the body says `"Unauthorized"` but the HTTP status is 403, and the import-domain routes return plain `Response` text bodies instead of JSON; (4) component file naming inconsistency between the `components/system/` folder (PascalCase) and every other component folder (kebab-case); and (5) two separate schema files for the same Better Auth tables (`/auth-schema.ts` at root and `src/db/schema.ts`), where `auth-schema.ts` is orphaned and never imported anywhere.

---

## Library Duplication

**No duplicate HTTP client libraries.** Every HTTP call — to AniList (`src/lib/anilist.ts:93`), Jackett (`src/lib/jackett.ts:45`), Deluge (`src/lib/deluge.ts:15`), the Anki proxy (`src/lib/anki/client.ts:24`), cover caching (`src/lib/cover-cache.ts:37`), the Mokuro sidecar (`src/lib/mokuro-client.ts:26`), and service checks (`src/lib/system/service-checks.ts:43`) — uses the Web `fetch` API. No axios, ky, or got anywhere.

**No duplicate state-management libraries.** Local `useState` / `useReducer` for component state; React Context for cross-tree concerns (`src/contexts/download-status.tsx`, `src/contexts/settings.tsx`, `src/contexts/theme.tsx`). No Zustand, Jotai, Redux, SWR, or TanStack Query.

**`adm-zip` and `bsdtar`/`7zip` both present for archive extraction** (`src/lib/extractor.ts`). `adm-zip` handles `.zip`/`.cbz`; `bsdtar` handles `.rar`/`.cbr`; `7zip` handles `.7z`. These are non-overlapping format domains, so this is not a true duplication — but it does mean three separate extraction mechanisms must be maintained. Recommendation: keep as-is; the format coverage is intentional.

---

## Data-Fetching Divergence

### Pattern A — Server Component direct DB access (dominant, correct)
The primary data-fetching pattern: server components call the Drizzle ORM directly (synchronously, via better-sqlite3) at render time. No HTTP round-trip. Used in all page files that have server-side data:
- `src/app/page.tsx` (library list)
- `src/app/manga/[id]/page.tsx`
- `src/app/manga/[id]/read/[volumeNumber]/page.tsx`
- `src/app/manager/page.tsx`
- `src/app/manager/[id]/page.tsx`
- `src/app/system/status/page.tsx`
- `src/app/settings/account/page.tsx`, `src/app/settings/admin/page.tsx`

### Pattern B — REST API route + client `fetch` in `useEffect`
A second fetching layer for data that must update without full page reloads (polling, user interaction):
- `src/contexts/download-status.tsx` — polls `/api/downloads/status` every 2–10 seconds via `fetch` in a `useEffect`-equivalent (`useCallback` + `setTimeout`)
- `src/contexts/settings.tsx` — loads preferences from `/api/user/preferences` in `useEffect` on mount
- `src/contexts/theme.tsx` — fires-and-forgets a `PUT /api/user/preferences` on theme change
- `src/components/auth/admin-panel.tsx` — loads users from Better Auth's own API in `useEffect`
- `src/components/system/StatusPage.tsx:127` — fetches `/api/system/status` in an event handler
- `src/components/system/HealthBadge.tsx:16` — fetches `/api/system/health` in `useEffect`
- `src/components/import/import-history.tsx:60` — fetches `/api/import/history` on mount (`.then(console.error)` for errors)
- `src/components/reader.tsx:208` — fetches OCR JSON in `useEffect` per volume

### Pattern C — REST API routes that duplicate server-component logic (HIGH concern)
`/api/manga` (`src/app/api/manga/route.ts`) and `/api/manga/[id]` compute `completedVolumes`, `progressPercent`, `progressByVolume`, and `lastRead` — the exact same aggregation already computed in `src/app/page.tsx` (lines 69–94) and `src/app/manga/[id]/page.tsx` (lines 79–117). These REST routes are not called by any component in the codebase (the server components fetch directly from DB). The REST routes appear to be legacy infrastructure from before the App Router migration, or built speculatively for a future mobile client.

**Recommendation:** Retire `/api/manga` and `/api/manga/[id]` if they have no callers, or document them as a public API. If kept, extract the aggregation logic into a shared function in `src/lib/` so it is not duplicated.

---

## Naming Inconsistencies

### Component file naming: kebab-case vs PascalCase
- **kebab-case** — every component outside `components/system/`: `manga-card.tsx`, `download-indicator.tsx`, `import-wizard.tsx`, `reader.tsx`, `confirm-dialog.tsx`, etc. (40+ files)
- **PascalCase** — exclusively `src/components/system/`: `DiskUsage.tsx`, `HealthBadge.tsx`, `HealthBanner.tsx`, `ServiceCard.tsx`, `StatsGrid.tsx`, `StatusPage.tsx`, `SystemAbout.tsx`, `TaskTable.tsx`

Canonical form: **kebab-case** — it is used by the overwhelming majority (40:8) and is consistent with Next.js conventions.

### Auth error response body vs HTTP status code
- Routes that check a user is simply authenticated (`getSession`): return `{ error: "Unauthorized" }` with HTTP 401 — e.g. `src/app/api/manga/route.ts:12`, `src/app/api/progress/[mangaId]/route.ts:13`.
- Routes that require admin (`requireAdmin`): return `{ error: "Forbidden" }` with HTTP 403 — e.g. `src/app/api/manager/manga/route.ts:13`.
- **Import domain routes using `requireAdmin` but returning "Unauthorized" body with 403**: `src/app/api/import/history/route.ts:12`, `src/app/api/import/analyze/route.ts:81`, `src/app/api/import/browse/route.ts:44`, `src/app/api/import/execute/route.ts:15`, `src/app/api/import/upload/route.ts:23`, `src/app/api/import/upload/init/route.ts:10`, `src/app/api/import/upload/progress/[sessionId]/route.ts:13`, `src/app/api/import/session/[sessionId]/route.ts:13`. All ten import routes say "Unauthorized" in the body while returning HTTP 403 — the semantic inverse of what 403 means.

Canonical form: **`{ error: "Forbidden" }` + 403** for `requireAdmin` guards; **`{ error: "Unauthorized" }` + 401** for `getSession` guards.

### `lastRead` vs `lastReadAt`
- `src/app/api/manga/route.ts:41` uses a local variable named `lastRead` but returns it under the key `lastReadAt` (line 50).
- `src/app/page.tsx:75` names the local `lastReadAt` directly.
- The DB column is `last_read_at`; the TypeScript field is `lastReadAt`.

Canonical form: **`lastReadAt`** everywhere, matching the schema column name.

### Page default export function naming
Most pages have descriptive names: `LibraryPage`, `MangaDetailPage`, `ReaderPage`, `ManagerRoute`, etc. `src/app/downloads/page.tsx` exports `function Page()` — no descriptive name.

Canonical form: **descriptive names** (`DownloadsPage`).

### `id` vs `Id` in variable names
- `mangaId`, `volumeId`, `anilistId` — camelCase with lowercase `d` — consistent throughout all DB schema, route params, and component props.
- No `ID` (all-caps) found.

No inconsistency found here.

---

## Pattern Divergence

### Response construction in route handlers: `NextResponse.json` vs `Response.json` vs plain `new Response`
- `NextResponse.json(...)` — used in 158 places, every route in the codebase.
- `Response.json(...)` — used in exactly 1 place: `src/app/api/auth/setup-status/route.ts:13`.
- `new Response("Unauthorized", { status: 403 })` — plain text body — used in 2 import routes: `src/app/api/import/progress/[importId]/route.ts:33` and `src/app/api/import/preview/[sessionId]/[volumeIndex]/[pageIndex]/route.ts:26`.
- `new NextResponse("Unauthorized", { status: 401 })` — plain text body — used in `src/app/api/covers/[anilistId]/route.ts:16`.

These four outliers break client-side callers that assume a JSON body on all error responses.

**Recommendation:** Use `NextResponse.json({ error: "..." }, { status })` universally. `Response.json` is equivalent at runtime but forces readers to distinguish the two symbols. The plain-text `new Response(...)` bodies are the most harmful because callers calling `.json()` on them will throw.

### Timestamp mode in schema: `"timestamp"` vs `"timestamp_ms"`
- **`"timestamp"` (unix seconds)** — all application tables defined in `src/db/schema.ts` (manga, volume, readingProgress, managedManga, managedVolume, downloadHistory, importHistory, userPreferences, volumeOcr, most Better Auth tables).
- **`"timestamp_ms"` (unix milliseconds)** — the `passkey.createdAt` column in `src/db/schema.ts:121`, and all columns in the orphaned `auth-schema.ts`.

The mismatch on `passkey.createdAt` is subtle: it stores milliseconds in a column that Drizzle will interpret as seconds unless consistently queried with `timestamp_ms`. The `lastImportAt` calculation in `src/lib/system/db-stats.ts:63` already guards against this with `new Date((lastImport.lastAt as number) * 1000)` suggesting awareness of the ambiguity.

**Recommendation:** `"timestamp"` (seconds via `unixepoch()`) for all application-owned columns; accept `"timestamp_ms"` only for Better Auth-generated columns where the library writes milliseconds.

### Timestamp writes: `new Date()` vs `sql\`(unixepoch())\``
- DB schema default for timestamp columns: `sql\`(unixepoch())\`` — SQLite evaluates at insert time.
- Code-level updates: `new Date()` (a JavaScript Date object serialised to unix seconds by Drizzle) — e.g. `src/app/api/progress/[mangaId]/[volumeId]/route.ts:43-44`, `src/app/api/manager/manga/[id]/download/route.ts:90`.
- A few places use `sql\`(unixepoch())\`` explicitly on updates: `src/app/api/user/preferences/route.ts:136`, `src/lib/ocr.ts:62`.

Both approaches produce unix-second integers in SQLite when using `"timestamp"` mode; Drizzle handles the conversion of `new Date()`. This is functionally equivalent but visually inconsistent. Recommendation: prefer `new Date()` for runtime writes (more readable, avoids raw SQL); reserve `sql\`(unixepoch())\`` for schema defaults.

### Env-var constant duplication
The following constants are re-declared once per file rather than imported from a shared config:

- `MANGA_DIR = process.env.MANGA_DIR || "/manga"` — **14 files**:
  `src/lib/scanner.ts:14`, `src/lib/importer.ts:26`, `src/lib/image-resolver.ts:7`, `src/lib/ocr.ts:15`, `src/lib/cover-cache.ts:4`, `src/lib/thumbnails.ts:6`, `src/lib/system/disk.ts:9`, `src/lib/system/health-checks.ts:23`, `src/app/api/delete/route.ts:9`, `src/app/api/manga/[id]/volume/[volumeNumber]/pages/route.ts:9`, `src/app/api/import/progress/[importId]/route.ts:25`, `src/app/api/import/analyze/route.ts:27`, `src/app/api/import/browse/route.ts:9`, `src/lib/system/system-info.ts:60`

- `IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"])` — **7 files**:
  `src/lib/scanner.ts:25`, `src/lib/importer.ts:30`, `src/lib/image-resolver.ts:8`, `src/app/api/manga/[id]/volume/[volumeNumber]/pages/route.ts:10`, `src/app/api/import/analyze/route.ts:29`, `src/app/api/import/preview/[sessionId]/[volumeIndex]/[pageIndex]/route.ts:10`, `src/app/api/import/browse/route.ts:10`

- `DELUGE_URL` — declared in both `src/lib/deluge.ts:1` and `src/lib/system/service-checks.ts:6`

- `DATABASE_URL` fallback default **split between two values**:
  - `"./data/mangashelf.db"` (relative) — `src/db/index.ts:7` and `src/db/migrate.ts:7`
  - `"/data/mangashelf.db"` (absolute) — `src/app/api/system/database/vacuum/route.ts:9`, `src/lib/system/disk.ts:10`, `src/lib/system/system-info.ts:82`
  This is a functional inconsistency: in development without `DATABASE_URL` set, `db/index.ts` resolves to `./data/mangashelf.db` relative to CWD while `vacuum/route.ts` uses the absolute path `/data/mangashelf.db`. In Docker both agree (env var is always set), but the inconsistency means running `npm run dev` without the env var will point the vacuum API at a different file than the actual database.

- `JUNK_DIRS` — declared in both `src/lib/extractor.ts:9` (only `__macosx`) and `src/lib/importer.ts:31` (`__macosx` and `.ds_store`). The sets disagree on content, which means `.DS_Store` directories survive extraction but are excluded during import scanning.

**Recommendation:** Create `src/lib/constants.ts` exporting `MANGA_DIR`, `IMAGE_EXTENSIONS`, `DATABASE_URL`, and `DOWNLOAD_DIR`. Fix `DATABASE_URL` default to a single canonical value. Reconcile `JUNK_DIRS` into one shared definition.

### `DOWNLOAD_DIR` hardcoded vs env var
`src/lib/importer.ts:27`: `const DOWNLOAD_DIR = "/downloads"` — hardcoded, ignores the `DELUGE_DOWNLOAD_DIR` env var documented in `CLAUDE.md`. The env var is passed to `addTorrent` in `src/lib/deluge.ts:65` when provided, but the importer always reads from `/downloads` regardless.

### `auth-schema.ts` orphaned file
`/Users/yoran/mangashelf/auth-schema.ts` is a root-level file defining the same six Better Auth tables (`user`, `session`, `account`, `verification`, `twoFactor`, `passkey`) as `src/db/schema.ts`. No file in the codebase imports from `auth-schema.ts`. `drizzle.config.ts` points only to `src/db/schema.ts`. The orphan appears to be a leftover from scaffolding Better Auth and should be deleted.

Notable differences between the two definitions:
- `auth-schema.ts` uses `timestamp_ms` mode; `src/db/schema.ts` uses `timestamp` mode for all the same columns (except `passkey.createdAt`).
- `src/db/schema.ts` `user` table has extra application columns (`role`, `banned`, `banReason`, `banExpires`, `twoFactorEnabled`) that are absent in `auth-schema.ts`.

### ~~`proxy.ts` naming~~ — RETRACTED
Original claim was wrong. Next.js 16 renamed `middleware` → `proxy` ([docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)). `src/proxy.ts` is canonical: location (`src/` or root), named `proxy` export (or default), and `export const config = { matcher: [...] }` all conform to the v16 contract. `next` v16.1.6 is in `package.json`. Auth IS running.

---

## Routing / API Shape Inconsistencies

### No Pages Router present
Only `app/` routes exist. No `pages/` directory. No `getServerSideProps` or `getStaticProps`. App Router is used exclusively — no migration concern.

### `params` awaiting — consistent
All dynamic route handlers correctly `await params` before destructuring (Next.js 16 requirement). No violations found.

### Auth guard selection
- User-level auth (`getSession`) → returns 401 — correct for unauthenticated access
- Admin-level auth (`requireAdmin`) → returns 403 — correct for authorised-but-not-admin
- Import routes — use `requireAdmin` but return `{ error: "Unauthorized" }` with 403 — body/status mismatch (enumerated above)

### `dynamic = "force-dynamic"` — partially applied
Present on routes that read from the database (`/api/manga`, `/api/manager/manga`, `/api/downloads/status`, `/api/system/status`, `/api/system/health`). Missing from `/api/library/scan`, `/api/manager/import`, `/api/manager/monitor/run`, `/api/delete`, and most import routes that mutate state. For POST-only routes this doesn't matter (they're always dynamic), but for routes that both GET and mutate, the absence is benign yet inconsistent.

### API route logic vs server component logic
As noted under Data Fetching, `/api/manga` and `/api/manga/[id]` replicate exactly the same Drizzle queries and JavaScript aggregations that `src/app/page.tsx` and `src/app/manga/[id]/page.tsx` already execute server-side. The API routes are dead code from the perspective of the UI.

---

## Styling Inconsistencies

### Tailwind utility classes (dominant, correct)
All components use Tailwind utility classes as the primary styling mechanism.

### Inline styles (`style={{...}}`) — 28 instances
Used when dynamic values cannot be expressed as Tailwind classes — percentage-based progress bars (`width: \`${progress}%\``), CSS custom property values (`containerType`, `env(safe-area-inset-bottom)`), colour swatches in the theme picker. These are all legitimate uses of inline styles for genuinely dynamic values. Not a concern.

### No CSS Modules, no styled-components, no Emotion
Styling is entirely Tailwind + a handful of justified inline `style` props. Clean.

### Tailwind default palette bleeding into the semantic design system
The design system uses `surface-*` and `accent-*` custom scales. However, 129 Tailwind class instances across 7+ files use the default Tailwind palette (`blue-`, `green-`, `red-`, `yellow-`, `emerald-`, `amber-`) for semantic status colours (download progress, OCR badges, error states):
- `src/app/manga/[id]/page.tsx` (lines 196–320): status badges hardcode `bg-green-500/15`, `bg-blue-500/15`, `bg-yellow-500/20`, `bg-emerald-500/15`, `bg-amber-500/15`, `bg-red-500/15`
- `src/components/downloads-page.tsx` (lines 59, 85): status banners use `blue-500` and `green-500`
- `src/components/confirm-dialog.tsx:136`: delete button uses `bg-red-500`
- `src/components/selection-bar.tsx:45`: delete button uses `bg-red-500`
- `src/components/dict-settings.tsx` (lines 154, 196, 213): uses `green-`, `red-` colours
- `src/components/manager/manager-page.tsx` (line 195): uses `blue-500` for downloading badge

The surface-650 class used in `src/components/downloads-page.tsx` (lines 147, 197) references a non-existent Tailwind token — `surface-650` is not defined in `globals.css`. This will silently produce no background colour.

**Recommendation:** Define semantic Tailwind tokens for status states (`error`, `warning`, `success`, `info`) in `globals.css`, or standardise on a subset of the default palette. Fix `surface-650` by either adding the token or changing to `surface-600`/`surface-700`.

---

## Other Inconsistencies

### Logging: `console.*` used directly, no structured logger
101 `console.log/warn/error` calls scattered throughout `src/`. The prefix format varies:
- `[MangaShelf]` — used in `scanner.ts`, `instrumentation.ts`, `extractor.ts`
- `[Monitor]` — used in `monitor.ts` and route handlers
- `[Manager]` — used in several `/api/manager/` routes
- `[Jackett]` — `jackett.ts`
- `[IMPORT]` — `import-session.ts` and `importer.ts`
- No prefix — `deluge.ts`, `anilist.ts`, `thumbnails.ts`, `cover-cache.ts`

There is no structured logger. All log levels are raw `console.*` calls. This is consistent at least in its choice of tool (no `winston` or `pino`), but the prefix conventions are ad-hoc.

### Error handling in client components: silent vs. logged
- Most mutation handlers in `manager-page.tsx`, `library-filter.tsx`, `manga-detail.tsx` have `catch { /* silently fail */ }` with no user feedback on error.
- Some handlers show `toast.error(...)` (reader's Anki flow).
- Some log to `console.error` (`admin-panel.tsx`).
- `import-history.tsx:63` does `.catch(console.error)` inline, which will log the error as a bare function reference's result rather than a meaningful message.

### Validation: entirely manual, no schema library
Every route handler validates request bodies with manual `typeof` checks and guards (e.g. `if (!anilistId || typeof anilistId !== "number")`). No Zod, Yup, or Valibot. This is consistent (zero schema-validation libraries used) but means request-body errors produce bespoke error messages that don't follow a common shape.

### DB query pattern: Drizzle query builder only
All DB access uses Drizzle's chainable query builder (`.select().from().where().all()`, etc.). One exception: `src/app/api/system/database/vacuum/route.ts:24` uses `db.run(sql\`VACUUM\`)` — a raw SQL call. This is justified (VACUUM has no query-builder equivalent) and is the only raw SQL usage.

---

## Priority Ranking (Top 10 by Maintainability Cost)

1. **`MANGA_DIR`, `IMAGE_EXTENSIONS`, `DATABASE_URL` declared in 14/7/5 separate files** — HIGH. Any change to defaults or logic must be made in every file independently, and the `DATABASE_URL` split between `"./data/…"` and `"/data/…"` is a latent bug in dev environments. Fix: create `src/lib/constants.ts`.

2. **`JUNK_DIRS` definition mismatch between `extractor.ts` and `importer.ts`** — LOW (downgraded from HIGH after fact-check). The two files split the constant differently: `extractor.ts` has `JUNK_FILES = {thumbs.db, .ds_store, desktop.ini}` + `JUNK_DIRS = {__macosx}` (file vs dir distinction); `importer.ts` has a single `JUNK_DIRS = {__macosx, .ds_store}`. `.DS_Store` IS cleaned by both — the extractor catches it via `JUNK_FILES`. Original claim that `.DS_Store` survives extraction was wrong. Real issue: the two files disagree on whether `.ds_store` is a file or directory, and `thumbs.db`/`desktop.ini` are only handled by the extractor.

3. **Import routes return `{ error: "Unauthorized" }` with HTTP 403** — HIGH. All 10 import-domain route handlers send the semantically wrong error message body for the HTTP status code. Any client or future API consumer will misinterpret the response.

4. **`auth-schema.ts` orphaned duplicate schema at project root** — MEDIUM. It defines the same tables as `src/db/schema.ts` with different column modes (`timestamp_ms` vs `timestamp`). If accidentally used by a future `drizzle-kit` command or migration, it will generate incorrect migrations.

5. ~~`proxy.ts` is not a valid Next.js middleware file~~ — **RETRACTED**. Next.js 16 renamed `middleware.ts` → `proxy.ts`. The file is canonical; auth runs.

6. **`/api/manga` and `/api/manga/[id]` duplicate server component DB logic** — MEDIUM. The aggregation of `completedVolumes`, `progressPercent`, and `lastReadAt` is computed twice: once in the server component (the real render path) and again in the REST API (which no client component calls). Dead code that will silently diverge as the schema evolves.

7. **`components/system/` PascalCase file names vs kebab-case everywhere else** — MEDIUM. Refactoring or moving files between directories will hit import path errors and confusion.

8. **`surface-650` Tailwind class used in `downloads-page.tsx` but not defined** — MEDIUM. `hover:bg-surface-650` silently produces no hover background on the download card elements (lines 147, 197).

9. **Auth 401 vs 403 response class inconsistency: `new Response("…")` text bodies in 3 routes vs JSON everywhere else** — MEDIUM. `src/app/api/import/progress/[importId]/route.ts:33`, `src/app/api/import/preview/[sessionId]/[volumeIndex]/[pageIndex]/route.ts:26`, and `src/app/api/covers/[anilistId]/route.ts:16` return plain-text response bodies. Any caller doing `res.json()` will throw a parse error.

10. **`DOWNLOAD_DIR` hardcoded to `"/downloads"` in `importer.ts`** — LOW-MEDIUM. The `DELUGE_DOWNLOAD_DIR` env var documented in `CLAUDE.md` affects where Deluge saves files, but the importer always reads from the hardcoded path. If `DELUGE_DOWNLOAD_DIR` is changed, the importer will fail to find completed downloads.
