# Dead Code Audit — MangaShelf

## Summary

The codebase is generally well-structured with few orphan symbols. The most significant findings are: `src/db/types.ts` exports five type aliases that are never imported anywhere; `auth-schema.ts` at the repo root appears to be a Better Auth scaffolding artifact never consumed by the application; and several exported functions (`getSqliteClient`, `getCachedCoverPath`, `findArchives`, `getActiveTorrents`, `searchTorrents`, `volumeFolderPath`, `mokuroFilePath`, `startImportInterval`) are exported but only used internally or not at all. Additionally, `src/lib/monitor.ts` contains an assigned-but-unused variable (`existingVolumes`) and an unreachable private function (`getMedianSize`) that was stubbed out when the planned feature (size-based torrent scoring) was deferred.

> **Correction (2026-05-12):** The original audit flagged `src/proxy.ts` as an unreferenced orphan file. This was wrong. Next.js 16 renamed the `middleware` file convention to `proxy` (see [Next.js 16 proxy docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)). `src/proxy.ts` is a framework entry point loaded directly by the Next.js runtime, like `instrumentation.ts` and `route.ts`/`page.tsx`. It is not dead code.

---

## Unused Exports

**`/Users/yoran/mangashelf/src/db/types.ts:L1-L9`** — exports `Manga`, `NewManga`, `Volume`, `NewVolume`, `ReadingProgress`
No file in the repo imports from `@/db/types`. The types are equivalent to inline `InferSelectModel<typeof ...>` calls; the file was likely a legacy convenience wrapper that was abandoned when the rest of the code switched to importing schema tables directly.

**`/Users/yoran/mangashelf/src/db/index.ts:L44`** — exported `getSqliteClient`
Never imported outside of its own file. Exported as an escape hatch for raw SQL (the JSDoc says "FTS5, virtual tables"), but no consumer exists in the current codebase.

**`/Users/yoran/mangashelf/src/lib/cover-cache.ts:L17`** — exported `getCachedCoverPath`
Only `getCachedCover` is imported elsewhere (`/api/covers/[anilistId]/route.ts`). `getCachedCoverPath` (the synchronous path-only variant) has zero importers.

**`/Users/yoran/mangashelf/src/lib/extractor.ts:L18`** — exported `findArchives`
Called internally by `extractIfNeeded` (same file, L63), but never imported by any other module. The export is unnecessary.

**`/Users/yoran/mangashelf/src/lib/deluge.ts:L115`** — exported `getActiveTorrents`
No file imports or calls this function. The download-progress polling uses `getTorrentStatus` (per-torrent), not the bulk query.

**`/Users/yoran/mangashelf/src/lib/jackett.ts:L29`** — exported `searchTorrents`
Only called internally by `searchMangaVolumes` in the same file. No external importer.

**`/Users/yoran/mangashelf/src/lib/ocr.ts:L22`** — exported `mokuroFilePath`
Called internally within `ocr.ts` only (lines 248, 429). No external importer.

**`/Users/yoran/mangashelf/src/lib/ocr.ts:L29`** — exported `volumeFolderPath`
Called internally within `ocr.ts` only (line 249). No external importer.

**`/Users/yoran/mangashelf/src/lib/importer.ts:L1409`** — exported `startImportInterval`
Explicitly marked `@deprecated`, aliased to `startBackgroundTasks`. Zero callers anywhere in the repo.

**`/Users/yoran/mangashelf/src/lib/auth-client.ts:L20`** — named re-exports `useSession`, `signIn`, `signUp`, `signOut`
These four named exports are never destructure-imported. All call sites use the `authClient` object directly (e.g., `authClient.signOut()`, `authClient.useSession()`). The re-exports are dead but harmless.

---

## Unreferenced Files

~~**`/Users/yoran/mangashelf/src/proxy.ts`** — RETRACTED.~~ Next.js 16 framework entry point (renamed from `middleware.ts`). Auth IS running. See correction at top of file.

**`/Users/yoran/mangashelf/src/db/types.ts`**
As noted above — no importer exists. The file only re-exports five `InferSelectModel`/`InferInsertModel` aliases from the schema tables, all of which are available directly.

**`/Users/yoran/mangashelf/auth-schema.ts`** (repo root)
Not referenced by any TypeScript file, `drizzle.config.ts`, or the `package.json` scripts. This is the Better Auth auto-generated schema scaffold from the `npx better-auth generate` command; the actual schema is in `src/db/schema.ts`. The root file appears to be an artifact left over from the initial Better Auth setup.

**`/Users/yoran/mangashelf/scripts/generate-icons.mjs`**
Not listed in `package.json` scripts, not referenced in the `Dockerfile` or `compose.yaml`. This is a one-off icon-generation utility that has no automated trigger — it was presumably run manually once and then left in place.

---

## Unreachable Code

**`/Users/yoran/mangashelf/src/lib/monitor.ts:L97-L106`** — `existingVolumes` query result is never read
The database query (`db.select().from(managedVolume)...`) executes and its result is stored in `existingVolumes`, but the variable is never referenced again. The immediately following comment (L108-L110) explains why: `"We don't store file sizes in managedVolume, so medianSize will be null unless we add that later."` The `medianSize` variable is always `null` (L110), so the `if (medianSize && ...)` branch inside `scoreTorrent` (L38-41) is never taken at runtime.

**`/Users/yoran/mangashelf/src/lib/monitor.ts:L46-L53`** — private function `getMedianSize` is never called
The function is defined and well-formed, but no call site exists. It was presumably planned to complement the `existingVolumes` query above, and both stubs were left in place when the feature was deferred.

---

## Stale Commented-Out Blocks

No large commented-out code blocks (5+ lines of actual code) were found in the source tree. The multi-line comment blocks flagged by a naive scanner are all JSDoc documentation comments, algorithm-explanation comments, or inline commentary — not disabled code.

---

## Orphan Utilities

**`/Users/yoran/mangashelf/src/lib/cover-cache.ts:L17`** — `getCachedCoverPath` (see Unused Exports above)

**`/Users/yoran/mangashelf/src/db/index.ts:L44`** — `getSqliteClient` (see Unused Exports above)

**`/Users/yoran/mangashelf/src/lib/monitor.ts:L46`** — `getMedianSize` — private helper that was written in anticipation of a feature (volume-size-based torrent scoring) that was not completed. Currently unreachable.

---

## Verification Caveats

**Drizzle schema re-exports**: All tables in `src/db/schema.ts` are consumed via `import * as schema` in `src/db/index.ts` and passed to `drizzle(sqlite, { schema })`. Drizzle uses these for relational queries (`db.query.*`). The individual table exports (`user`, `session`, `account`, etc.) are also used directly in API routes. No schema exports appear dead, but the relational query layer is opaque to a static grep.

**Better Auth plugin consumption**: Better Auth reads the schema via the `drizzleAdapter` in `src/lib/auth.ts`. The `user`, `session`, `account`, `verification`, `twoFactor`, and `passkey` tables in `src/db/schema.ts` are all consumed implicitly by Better Auth even if no application code queries them directly. None of those are flagged as dead.

**Next.js implicit consumers**: `src/instrumentation.ts`, `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`), and all `route.ts` / `page.tsx` files are loaded by the Next.js runtime directly — correctly excluded from dead-file scanning.

**Dynamic imports in `src/instrumentation.ts`**: The instrumentation file uses `await import(...)` for `scanner`, `importer`, `monitor`, `ocr`, and `import-session`. These modules' default exports are not statically visible; all were verified by reading their exported function names and cross-referencing call sites.

---

## Priority Ranking (Safest to Delete First)

1. **`/Users/yoran/mangashelf/src/db/types.ts`** — zero callers, zero risk. Pure type file.

2. **`/Users/yoran/mangashelf/auth-schema.ts`** (repo root) — Better Auth scaffold artifact; the real schema is in `src/db/schema.ts`. Not referenced anywhere.

3. **`/Users/yoran/mangashelf/src/lib/monitor.ts:L97-L106`** — delete the `existingVolumes` DB query (6 lines). The variable is never read. The query runs on every `monitorSingleManga` call, doing unnecessary DB work.

4. **`/Users/yoran/mangashelf/src/lib/monitor.ts:L46-L53`** — delete `getMedianSize`. It is private, never called, and its companion variable `medianSize` is hardcoded to `null`.

5. **Remove the `export` keyword from `/Users/yoran/mangashelf/src/lib/extractor.ts:L18`** — `findArchives` is fine to keep as a private helper; just un-export it.

6. **Remove the `export` keyword from `/Users/yoran/mangashelf/src/lib/deluge.ts:L115`** — `getActiveTorrents` is dead export; if ever needed it can be re-exported.

7. **Remove the `export` keyword from `/Users/yoran/mangashelf/src/lib/jackett.ts:L29`** — `searchTorrents` is an internal helper for `searchMangaVolumes`.

8. **Remove the `export` keywords from `/Users/yoran/mangashelf/src/lib/ocr.ts:L22` and `L29`** — `mokuroFilePath` and `volumeFolderPath` are only used internally.

9. **`/Users/yoran/mangashelf/scripts/generate-icons.mjs`** — safe to delete if icons are already generated in `public/icons/`; or add a `package.json` script entry to make it discoverable.

10. **`/Users/yoran/mangashelf/src/lib/importer.ts:L1409`** — delete the deprecated `startImportInterval` alias (it's literally marked `@deprecated` and has no callers).

