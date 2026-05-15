# AI-slop audit — MangaShelf

## Summary

The codebase is generally well-structured for its complexity. The library business logic (importer, scanner, monitor) is clean and intentional. The majority of slop is concentrated in three areas: (1) a massive `formatBytes` copy-paste across six files with zero shared utility, (2) pervasive silent `catch {}` blocks in components that drop errors on the floor with no user feedback, and (3) type-laziness via `as unknown as` globalThis casts repeated identically four times. There are also a handful of real React anti-patterns — `.then()` chains inside `useEffect`, a `useCallback(() => ({ ...state }))` wrapper that creates a new object identity on every render anyway, and a hardcoded ternary that always resolves to the same value. Section-divider comments in `importer.ts` are borderline — the file is long enough they do add navigation value, but the double-dividers around every section are redundant noise.

---

## 1. Useless wrappers

**Count: 2**

**`src/lib/importer.ts:1408-1409`**
```ts
/** @deprecated Use startBackgroundTasks instead */
export const startImportInterval = startBackgroundTasks;
```
A dead alias. If nothing imports `startImportInterval` any more, delete it. If something does, fix the import and delete the alias.

**`src/contexts/download-status.tsx:167`**
```ts
const value = useCallback(() => ({ ...status, refresh }), [status, refresh]);
// ...
<DownloadStatusContext.Provider value={value()}>
```
`value` is a `useCallback`-memoised function that is immediately called with `value()`. This is useless wrapping: `useCallback` memoises the *function reference*, not the *result*. Calling it on every render creates a new object on every render anyway, defeating both the memoisation and the stable reference that `Context.Provider` needs to avoid re-renders. Replace with `useMemo(() => ({ ...status, refresh }), [status, refresh])` and pass the result directly to `value`.

---

## 2. Defensive try/catch

**Count: 7 egregious cases (dozens of minor ones listed)**

**`src/lib/scanner.ts:184-191` — catch around enqueueVolumeOcr**
```ts
try {
  enqueueVolumeOcr(inserted.id);
} catch (e) {
  console.warn(
    `[MangaShelf] OCR enqueue failed for new volume ${inserted.id}:`,
    e,
  );
}
```
`enqueueVolumeOcr` is a synchronous DB upsert. If the DB is broken the scan itself already ran without failure. The warn is fine, but the pattern appears twice (lines 184–191 and 237–244) because it's in both the insert-new and update-existing paths. Extract it.

**`src/app/api/library/scan/route.ts:11-17` — try/catch on syncLibrary returning a value**
```ts
try {
  const result = syncLibrary();
  return NextResponse.json(result);
} catch (error) {
  return NextResponse.json(
    { error: "Scan failed", details: String(error) },
    { status: 500 },
  );
}
```
This is fine in an API route. No complaint here — this one is correct.

**`src/components/manager/manga-detail.tsx:138`, `161`, `183` — three silent catch blocks in event handlers**
```ts
// handleDelete
} catch {
  setDeleting(false);
}

// handleCheckNow
} catch {
  // silently fail
}

// handleApproveDownload
} catch {
  // silently fail
}
```
The comment "silently fail" is honest but the wrong choice. All three fire mutations (DELETE from manager, monitor trigger, send torrent). When they fail the user sees nothing. At minimum `console.error` + a toast. The `handleDelete` case just resets the loading spinner with no feedback at all.

**`src/components/manager/manager-page.tsx:97`, `123`, `146`, `160` — four more silent catch blocks**
Same pattern. Mutations (download trigger, import trigger, monitor toggle, delete) failing silently.

**`src/lib/system/health-checks.ts:186-188`, `205-207`, `267-270`, `279-282`, `299-302`** — five bare `catch { // Skip }` inside `runHealthChecks`

These are health checks. Swallowing errors *inside* a health check function means health checks themselves can silently degrade. Acceptable only because they're querying already-established DB state — but each one should at least push a health check item noting "check failed" rather than returning nothing.

**`src/instrumentation.ts:5-8` — try/catch re-throws `syncLibrary` but keeps running**
```ts
try {
  const result = syncLibrary();
} catch (e) {
  console.error("[MangaShelf] Library scan failed:", e);
}
```
This swallows the error and continues to start background tasks. If the library scan fails (DB write fails), auto-import tasks will also fail. The catch is reasonable but should note that background tasks may be starting in a broken state.

**`src/app/api/manager/manga/[id]/search/route.ts:19`**
```ts
const body = await request.json().catch(() => ({}));
```
One-liner silent fallback on `request.json()`. If the client sends malformed JSON this silently sets `volumeNumber = undefined`. A 400 response would be better, but at least the behaviour downstream (search without a volume number) is documented.

---

## 3. Over-commenting

**Count: 6 patterns**

**`src/lib/importer.ts` — 30 section-divider pairs**
```
// ---------------------------------------------------------------------------
// Image file discovery
// ---------------------------------------------------------------------------
```
Thirty occurrences. Between lines 33–35, 74–76, 127–129, 159–161, 232–238, 306–308, 415–417, 592–594, 715–717, 739–741, 789–791, 830–831, 1033–1035, 1271–1277. The file is 1,409 lines and the sections are real, but every section has *two* divider lines (one blank-padded above, one below) making it 60 lines of pure decorative comment. Use single dividers if at all; better: split the file.

**`src/lib/importer.ts:232-238` — back-to-back duplicate section headers**
```
// ---------------------------------------------------------------------------
// Step 3: Assign volume numbers with fallbacks and deduplication
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Duplicate volume resolution
// ---------------------------------------------------------------------------
```
Two section headers for the same logical block 4 lines apart.

**`src/lib/system/health-checks.ts:1-3`**
```ts
/**
 * Health check engine — proactive warnings about misconfigurations and problems.
 */
```
The filename is `health-checks.ts`. The JSDoc adds nothing.

**`src/lib/system/system-info.ts:1-3`**
```ts
/**
 * System information for the status page.
 */
```
Same: filename says it all.

**`src/lib/system/db-stats.ts:1-3`**
```ts
/**
 * Database statistics for the status page.
 * All queries are synchronous (better-sqlite3).
 */
```
The sync note is worth keeping as it's non-obvious to future devs. The first line is not.

**`src/lib/background/task-registry.ts:1-3`**
```ts
/**
 * In-memory registry for background task status tracking.
 * Resets on server restart — only current-session state matters.
 */
```
The "resets on server restart" note is genuinely useful. The first line restates the filename.

---

## 4. Vague names

**Count: 3**

**`src/lib/system/health-checks.ts:43`** — `context` parameter:
```ts
export function runHealthChecks(context: {
  services: ServiceCheckResult;
  disk: LibraryDiskInfo;
  ...
}): HealthCheck[]
```
`context` is a generic blob name. Call the type `HealthCheckInput` or `SystemSnapshot` and give it a proper interface — especially since `StatusPage.tsx` duplicates several of the same types (`ServiceStatus`, `DiskInfo`, etc.) with no shared source.

**`src/app/api/manager/manga/[id]/route.ts:94`**
```ts
const updates: Record<string, unknown> = { updatedAt: new Date() };
```
`updates` typed as `Record<string, unknown>` used for a Drizzle `.set()`. Drizzle's `InferSelectModel`/`Partial` types exist specifically for this. The loose type means bad field names would pass TS and blow up at runtime.

**`src/lib/monitor.ts:280`**
```ts
const updates: Record<string, unknown> = {
  lastMetadataRefresh: new Date(),
  updatedAt: new Date(),
};
```
Same pattern in monitor.ts — `Record<string, unknown>` accumulator for Drizzle `.set()`.

---

## 5. Type laziness

**`as unknown as` — 4 occurrences in production code (tests excluded)**

**`src/lib/importer.ts:18`**
```ts
const _g = globalThis as unknown as { __mangashelf_importing?: boolean };
```

**`src/lib/scanner.ts:18`**
```ts
const g = globalThis as unknown as { __mangashelf_scanning?: boolean };
```

**`src/lib/import-session.ts:46`**
```ts
const _g = globalThis as unknown as {
  __mangashelf_import_sessions?: Map<string, ImportSession>;
};
```

**`src/lib/background/task-registry.ts:31`**
```ts
const _g = globalThis as unknown as {
  __mangashelf_task_registry?: Map<string, RegisteredTask>;
};
```

All four are the same pattern and all are legitimate: TypeScript doesn't let you add arbitrary properties to `globalThis` without an augmentation. The fix is a single shared module:
```ts
// src/lib/global-state.ts
declare global {
  var __mangashelf_importing: boolean | undefined;
  var __mangashelf_scanning: boolean | undefined;
  // etc.
}
export {};
```
Then use `globalThis.__mangashelf_importing` directly with no cast.

**`as` assertions on Deluge RPC results — `src/lib/deluge.ts:99–112`**
```ts
const result = (await rpc(...)) as Record<string, unknown> | null;
// ...
name: result.name as string,
state: result.state as string,
progress: result.progress as number,
```
Six `as T` assertions on fields of an untyped RPC response. This is unavoidable without a schema validator, but the Deluge response shape is known and stable — a Zod schema would be 10 lines and eliminate all six casts.

**`src/components/system/SystemAbout.tsx:90`**
```ts
const config = system.config as Record<string, unknown>;
```
`system.config` is typed as `Record<string, unknown>` in `StatusPage.tsx:92`. So the cast is casting an already-loose type to itself. The root fix is to type `SystemInfo.config` as the actual struct (all fields are known).

**`src/lib/system/service-checks.ts:126–134`** — five `as number/string` casts on `Record<string, unknown>` Deluge RPC fields. Same issue as deluge.ts above.

**`src/contexts/settings.tsx:53-58` — `unknown` fields and runtime type checks as a workaround**
```ts
interface PreferencesResponse {
  ocrEnabled?: unknown;
  copyStripLinebreaks?: unknown;
  textViewButton?: unknown;
  ankiSettings?: unknown;
}
```
All four fields typed as `unknown` so `fromResponse` can do manual runtime checks. This is fine correctness-wise but verbose — `z.object({...}).partial()` would be shorter and safer.

---

## 6. React / Next.js anti-patterns

**Count: 7**

**`src/components/reader.tsx:205-219` — `.then()` chain inside `useEffect`**
```ts
useEffect(() => {
  if (!ocrEnabled) return;
  let cancelled = false;
  fetch(`/api/manga/${mangaId}/volume/${volumeNumber}/ocr`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!cancelled) setOcrData(data as MokuroFile | null);
    })
    .catch(() => {});
  // ...
}, [ocrEnabled, mangaId, volumeNumber]);
```
The file uses `await` everywhere else. This is the only `.then()` chain. The cancellation token pattern works correctly here, but the inconsistency is jarring and the silent `.catch(() => {})` means OCR fetch failures are invisible.

**`src/contexts/settings.tsx:84-99` — `.then()` chain inside `useEffect` mixed with `await` in the same file**
```ts
useEffect(() => {
  let cancelled = false;
  fetch("/api/user/preferences")
    .then((r) => (r.ok ? r.json() : null))
    .then((data: PreferencesResponse | null) => {
      if (cancelled) return;
      if (data) setSettings(fromResponse(data));
      setLoaded(true);
    })
    .catch(() => {
      if (!cancelled) setLoaded(true);
    });
```
Same issue: the `save` function on line 101 is `async`/`await`. Two different async styles in the same component for no reason.

**`src/components/system/StatusPage.tsx:117-254` — data fetching in `useEffect` that should be a server component**
```ts
"use client";
// ...
const [data, setData] = useState<SystemStatus | null>(null);
useEffect(() => {
  fetchStatus();
  const interval = setInterval(() => fetchStatus(), 60_000);
  ...
}, [fetchStatus]);
```
`StatusPage` is mounted from `src/app/system/status/page.tsx`. The status page has `force-dynamic` (implicitly via its API call) and requires an admin session. The initial data load could be a server component SSR fetch; only the 60s auto-refresh and the manual refresh button genuinely require the client. The entire status page being `"use client"` means it ships its whole component tree to the browser and hydrates, including all sub-components (`HealthBanner`, `ServiceCard`, `TaskTable`, `DiskUsage`, `StatsGrid`, `SystemAbout`) which all have `"use client"` on them too — even `DiskUsage` and `StatsGrid` which render pure props with no interactivity.

**`src/components/system/DiskUsage.tsx:1` and `src/components/system/StatsGrid.tsx:1` — `"use client"` on pure presentational components**

`DiskUsage` has zero hooks, zero event handlers, zero browser APIs. It is a pure layout component that formats numbers and renders divs. `"use client"` is unnecessary — it only propagates down from `StatusPage`. Removing it from these two files won't change behaviour but documents intent correctly.

**`src/components/system/ServiceCard.tsx:44-48` — `useEffect` for derived state**
```ts
useEffect(() => {
  if (!testing) {
    setCurrent(service);
  }
}, [service, testing]);
```
This `useEffect` synchronises `current` with the `service` prop when not testing. This is derived state managed through an effect. The pattern introduces a render lag: on prop change, first render uses stale `current`, then the effect fires and triggers a second render with `current` updated. The fix is to remove `current` state entirely and compute it inline: `const current = testing ? localTestResult : service`.

**`src/components/import/import-progress.tsx:112` — suppressed exhaustive-deps warning**
```ts
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [importId]);
```
`done` is read inside the `onerror` handler but omitted from deps. This creates a stale closure: if `done` flips to `true` before the SSE error event, the stale `false` value means the guard `if (!done)` doesn't fire correctly. The correct fix is to use a ref for `done`.

**`src/components/system/HealthBadge.tsx:11-32` — `useEffect` fetching from an endpoint that could be SSR props**
```ts
useEffect(() => {
  async function fetchHealth() {
    const res = await fetch("/api/system/health");
    ...
  }
  fetchHealth();
  const interval = setInterval(fetchHealth, 60_000);
  ...
}, []);
```
`HealthBadge` is embedded in the nav. Every page load triggers a separate `/api/system/health` client-side fetch. Since this is always admin-only context, the initial counts could be passed as a server-side prop.

---

## 7. Other slop

**`formatBytes` duplicated 6 times**

```
src/lib/system/health-checks.ts:26         function formatBytes
src/components/system/DiskUsage.tsx:14     function formatBytes
src/components/system/ServiceCard.tsx:10   function formatBytes
src/components/system/SystemAbout.tsx:23   function formatBytes
src/components/dict-settings.tsx:242       function formatBytes
src/workers/dict-worker.ts:60             function formatBytes
```

Six copy-paste implementations of the same `formatBytes` function. The implementations are not identical either — `DiskUsage.tsx` handles `bytes <= 0` returning `"0 B"` while others don't. `health-checks.ts` and `SystemAbout.tsx` have the same 4-level threshold. One module `src/lib/format.ts` would eliminate this.

**`src/app/api/import/analyze/route.ts:300-305` — ternary that always evaluates to the same branch**
```ts
const detectedType: ImportAnalysis["detectedType"] =
  volumes.length === 0
    ? "unknown"
    : volumes.length === 1
      ? "single_manga"
      : "single_manga"; // Most cases — multiple volumes of one manga
```
The comment explains it: both non-zero branches return `"single_manga"`. Either remove the inner ternary or add a real "multi_manga" detection path. Currently `detectedType` is binary: `"unknown"` or `"single_manga"`.

**`src/lib/importer.ts:1351-1355` — registerTask wrapping a function already registered**
```ts
registerTask("download-progress", {
  description: "Poll Deluge for download progress updates",
  intervalMs: PROGRESS_INTERVAL_FAST,
  run: async () => {
    await progressTick();
    return "Progress check completed";
  },
});
```
`progressTick` already calls `taskStarted`/`taskCompleted`/`taskFailed` internally. The `run` wrapper in `registerTask` would double-call those if `triggerTask` is ever used. The task registry and the manual timer are fighting over ownership of the same task's lifecycle.

**`src/app/api/manager/manga/route.ts:22-46` — N+1 query in GET handler**
```ts
const allManga = db.select().from(managedManga).orderBy(managedManga.titleRomaji).all();
const result = allManga.map((m) => {
  const volumes = db.select().from(managedVolume)
    .where(eq(managedVolume.managedMangaId, m.id)).all();
  // ...
});
```
One query per manga to load volumes. For a manager with 50 titles this is 51 queries. Use a JOIN or a single `inArray` query, then group in JavaScript.

**`src/lib/system/db-stats.ts:49-152` — 11 separate synchronous DB queries for stats**
```ts
const mangaTotal = db.select({ count: count() }).from(manga).get()!.count;
const mangaWithAnilist = db.select({ count: count() }).from(manga).where(...).get()!.count;
// ... 9 more
```
Every call to `getDatabaseStats()` (which happens on every `/api/system/status` and `/api/system/health` request) fires 11 round-trips to SQLite. These could be a single `SELECT ... COUNT(CASE WHEN ...) AS ...` query each for the manga and managedVolume tables.

---

## Priority ranking (top 10 by code-quality impact)

1. **`src/components/system/StatusPage.tsx` + all `system/` sub-components** — wholesale `"use client"` on static display components (`DiskUsage`, `StatsGrid`) and `useEffect` data fetching on the status page that should use SSR. Medium effort, high correctness and performance gain.

2. **`formatBytes` 6-way duplication** — create `src/lib/format.ts`, replace all 6. Low effort, high maintainability gain. The slight behaviour divergence (`DiskUsage` handles `<= 0` differently) is a latent bug.

3. **`src/contexts/download-status.tsx:167` — `useCallback` + immediate call** — replace with `useMemo`. The current code re-creates the context value object on every render, defeating the Context.Provider's ability to avoid re-renders for all consumers (reader, download indicator, manager pages, etc.).

4. **`src/components/system/ServiceCard.tsx:44` — `useEffect` for derived state** — replace `current` state + effect with inline computation. The two-render-phase flicker is a real UX issue when the status page auto-refreshes.

5. **`src/app/api/manager/manga/route.ts:22` — N+1 query** — fix with a join or bulk query. This hits SQLite once per managed manga on every manager page load.

6. **`globalThis as unknown as` pattern x4** — replace with a single `declare global {}` augmentation in one place. Four copies of the same type-escape hatch is noise, and the pattern is fragile (a typo in one of the four is invisible to TS).

7. **Silent `catch {}` in mutation handlers** — `manga-detail.tsx:138,161,183` and `manager-page.tsx:97,123,146,160`. Users get no feedback when downloads fail to send, monitoring fails to trigger, or deletes fail. Add `toast.error` at minimum.

8. **`src/components/reader.tsx:205` and `src/contexts/settings.tsx:84` — `.then()` chains mixing with `await`** — convert to `async` functions with proper cancellation tokens. The reader's OCR fetch failure is silently dropped.

9. **`src/app/api/import/analyze/route.ts:300` — always-`single_manga` ternary** — remove the dead branch. Dead code in a condition is a maintenance trap.

10. **`src/lib/importer.ts:1408` — deprecated alias `startImportInterval`** — find any remaining import and remove. A `@deprecated` export with no deletion timeline becomes permanent.
