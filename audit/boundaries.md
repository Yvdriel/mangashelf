# Module Boundary Audit — MangaShelf

## 1. Summary

MangaShelf has a generally clean architecture: server-only modules (`db`, `lib/scanner`, `lib/importer`, etc.) are not directly imported by `'use client'` components, and per-route `getSession()` calls protect all API endpoints. Four notable issues remain. First, the Reader domain directly queries Manager-domain tables (`managedManga`, `managedVolume`) inside Reader server components, coupling the two ostensibly-separate domains at the database layer. Second, `lib/system/service-checks.ts` duplicates the `DELUGE_URL`, `DELUGE_PASSWORD`, `JACKETT_URL`, and `JACKETT_API_KEY` `process.env` reads that already exist in `lib/deluge.ts` and `lib/jackett.ts`, creating drift risk. Third, no server-only modules use `import 'server-only'` as a compile-time guard. Fourth, `src/components/ocr-overlay.tsx` (`'use client'`) re-exports types from `@/lib/mokuro` (which itself uses `fs` and `@/db`); this is technically safe today because all imports from that file are `import type` / `export type`, but it's a fragile pattern one value-import away from a bundle breakage.

> **Correction (2026-05-12):** The original audit flagged `src/proxy.ts` as dead middleware. This was wrong. Next.js 16 renamed the `middleware` file convention to `proxy` (see [Next.js 16 docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)). The file location (`src/proxy.ts`) and named export (`export async function proxy`) are both canonical. Edge auth IS active. Sections referencing the false claim have been struck through below.

---

## 2. Server-only leaks into Client Components (CRITICAL)

**No runtime leaks found.** All imports from `'use client'` files into potentially server-side modules are type-only (`import type` / `export type`) and are erased by TypeScript before bundling.

**However, two patterns are one mistake away from becoming leaks:**

### 2a. `ocr-overlay.tsx` re-exports from `@/lib/mokuro` (fragile, not yet leaking)

`/Users/yoran/mangashelf/src/components/ocr-overlay.tsx` lines 4 and 6:

```ts
import type { MokuroBlock, MokuroPage } from "@/lib/mokuro";
export type { MokuroBlock, MokuroPage, MokuroFile } from "@/lib/mokuro";
```

`/Users/yoran/mangashelf/src/lib/mokuro.ts` line 1–3:

```ts
import fs from "fs";
import { resolveMokuroFile } from "@/lib/ocr";
```

`@/lib/ocr` in turn imports `better-sqlite3` via `@/db`. Both are `import type` today, so no runtime module is loaded. But `ocr-overlay.tsx` is the public re-export point for these types; if any consumer ever changes `import type` to a value import, `fs` and `better-sqlite3` land in the client bundle.

**Recommendation:** Define a standalone `src/lib/mokuro-types.ts` (pure interfaces, no `fs`/`db` imports) and point `ocr-overlay.tsx` there.

### 2b. No `import 'server-only'` guards on any server-only module

`/Users/yoran/mangashelf/src/db/index.ts`, `/Users/yoran/mangashelf/src/lib/scanner.ts`, `/Users/yoran/mangashelf/src/lib/importer.ts`, `/Users/yoran/mangashelf/src/lib/extractor.ts`, `/Users/yoran/mangashelf/src/lib/monitor.ts`, `/Users/yoran/mangashelf/src/lib/deluge.ts`, `/Users/yoran/mangashelf/src/lib/jackett.ts`, `/Users/yoran/mangashelf/src/lib/auth.ts`, `/Users/yoran/mangashelf/src/lib/ocr.ts` — none of these add `import 'server-only'` at the top. Without this guard, Next.js's bundler gives no compile-time error if a client component ever imports one of them.

**Recommendation:** Add `import 'server-only';` as the first line of each of those files.

---

## 3. Cross-domain Reach-throughs (Reader ↔ Manager)

### 3a. Reader server pages directly query Manager-domain tables

**Offending file:** `/Users/yoran/mangashelf/src/app/page.tsx` lines 3–7:

```ts
import {
  manga,
  readingProgress,
  managedManga,
  managedVolume,
} from "@/db/schema";
```

This page (the reader library listing) queries `managedVolume` at line 55–57 to show a "downloading" badge count, and joins to `managedManga` at line 32 to pull AniList cover URLs and genres. It is a server component in the Reader domain but queries Manager-domain tables directly.

**Offending file:** `/Users/yoran/mangashelf/src/app/manga/[id]/page.tsx` lines 5–7:

```ts
  managedManga,
  managedVolume,
```

Queries `managedManga` at line 43–47 and `managedVolume` at line 87–91 to surface download status alongside the volume list — a Reader-domain page pulling Manager-domain state.

**Why it's a violation:** The Reader and Manager domains share no documented API contract; direct table access means schema changes in the Manager domain (e.g., renaming `managedVolume.status`) silently break Reader pages. Moving or replacing the Manager subsystem would require editing Reader code.

**Recommendation:** Create a thin server-side data-access function (e.g., `getDownloadStatusByAnilistId(anilistId)`) in a shared `src/lib/bridge/` layer, or expose a narrow API route that the Reader page calls. This contains the cross-domain dependency to one explicit seam.

### 3b. The unified delete endpoint bridges domains in a single route handler

**Offending file:** `/Users/yoran/mangashelf/src/app/api/delete/route.ts` lines 4–5:

```ts
import { db } from "@/db";
import { manga, managedManga } from "@/db/schema";
```

This route (under `/api/delete`, a Reader-domain path namespace) performs "cross-domain resolution" (its own comment at lines 38 and 73) by joining Reader and Manager records via `anilistId`. The route is intentionally dual-domain but lives in the Reader namespace.

**Recommendation:** Move to `/api/library/delete` or a neutral `/api/admin/delete` path that makes the cross-domain intent explicit. Document the bridge role in a comment.

### 3c. `/api/downloads/status` mixes domains in the Reader API namespace

**Offending file:** `/Users/yoran/mangashelf/src/app/api/downloads/status/route.ts` lines 1–3:

```ts
import { db } from "@/db";
import { managedManga, managedVolume } from "@/db/schema";
```

This route path (`/api/downloads/...`, not `/api/manager/downloads/...`) queries exclusively Manager-domain tables and calls `isScanning()` (Reader) and `isImporting()` (Manager) side by side. The equivalent Manager route exists at `/api/manager/downloads/route.ts`; this appears to be a separate status indicator endpoint that straddles both.

**Recommendation:** Move to `/api/manager/status/downloads` or rename to make the multi-domain role explicit.

---

## 4. Internal Reach-throughs

### 4a. ~~`src/proxy.ts` — dead middleware code~~ — RETRACTED

**Original claim was wrong.** Next.js 16 renamed the `middleware` file convention to `proxy`. Per [official docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy):

- File location: `src/proxy.ts` or root `proxy.ts` — both canonical.
- Export: "must export a single function, either as a default export or named `proxy`." Named `proxy` is fully supported.
- `export const config = { matcher: [...] }` is the documented matcher API.
- `next` v16.1.6 is in `package.json`; the file conforms to the v16 contract.

Edge auth IS running. The session check, setup-redirect, and expiry-redirect logic in `src/proxy.ts` executes on every matched request. No action required.

**Migration note for future maintainers:** Next.js 16 codemod renames `middleware` → `proxy`; matcher config and behaviour are unchanged. The Edge runtime is no longer used by `proxy` (it runs Node.js); if any code in `proxy.ts` relies on Edge-only APIs, audit separately.

### 4b. `lib/system/service-checks.ts` duplicates config from `lib/deluge.ts` and `lib/jackett.ts`

**Offending file:** `/Users/yoran/mangashelf/src/lib/system/service-checks.ts` lines 6–9:

```ts
const DELUGE_URL = process.env.DELUGE_URL || "http://deluge:8112";
const DELUGE_PASSWORD = process.env.DELUGE_PASSWORD || "deluge";
const JACKETT_URL = process.env.JACKETT_URL || "http://jackett:9117";
const JACKETT_API_KEY = process.env.JACKETT_API_KEY || "";
```

These four constants are also defined — with identical default values — in `/Users/yoran/mangashelf/src/lib/deluge.ts` lines 1–2 and `/Users/yoran/mangashelf/src/lib/jackett.ts` lines 1–2. If the default URL or port for either service changes, it must be changed in three files.

**Recommendation:** Export `DELUGE_URL` / `DELUGE_PASSWORD` from `lib/deluge.ts` and `JACKETT_URL` / `JACKETT_API_KEY` from `lib/jackett.ts`, then import them in `service-checks.ts`.

---

## 5. Barrel-file Abuse

- **Total `index.ts` barrels found:** 1
- **With wildcard re-exports:** 0

The single barrel is `/Users/yoran/mangashelf/src/db/index.ts`, which exports `db` (a `Proxy`-based singleton) and `getSqliteClient()`. This is a well-scoped barrel at a module boundary. It does not wildcard-re-export.

`@/db/schema` is imported directly (not via the barrel) by 36 files across the codebase. This is normal; importing schema tables directly is idiomatic with Drizzle ORM.

**No barrel-file abuse found.** The codebase does not use barrel files across features or internal subfolders.

---

## 6. Circular Dependencies

**No circular dependencies detected** among the server-side service modules.

The dependency graph for key modules:

```
instrumentation.ts
  -> lib/scanner.ts -> lib/ocr.ts -> lib/mokuro-client.ts
  -> lib/importer.ts -> lib/deluge.ts
                     -> lib/scanner.ts (sync after import)
                     -> lib/extractor.ts
  -> lib/monitor.ts -> lib/jackett.ts
                    -> lib/deluge.ts
                    -> lib/anilist.ts
  -> lib/ocr.ts
  -> lib/import-session.ts
```

All edges are acyclic. `lib/background/task-registry.ts` has no internal imports; it is a pure in-memory registry.

---

## 7. Environment-coupling Bugs (`process.env` in client code)

No `process.env` access (outside of `NEXT_PUBLIC_*` variables) was found in any `'use client'` file, context, or hook. All server-side `process.env` reads occur in route handlers, server components, or server-only lib modules, which is correct.

**`process.env` duplication (server side):**

The environment variables `DELUGE_URL`, `DELUGE_PASSWORD`, `JACKETT_URL`, and `JACKETT_API_KEY` are read independently in three files:

| Variable | `/Users/yoran/mangashelf/src/lib/deluge.ts` | `/Users/yoran/mangashelf/src/lib/jackett.ts` | `/Users/yoran/mangashelf/src/lib/system/service-checks.ts` |
|---|---|---|---|
| `DELUGE_URL` | line 1 | — | line 6 |
| `DELUGE_PASSWORD` | line 2 | — | line 7 |
| `JACKETT_URL` | — | line 1 | line 8 |
| `JACKETT_API_KEY` | — | line 2 | line 9 |

This is a maintainability concern, not a runtime bug, but default value drift across files is a common source of subtle misconfiguration.

---

## 8. Priority Ranking (Top 10 by Risk)

| Rank | Risk | File(s) | Severity |
|---|---|---|---|
| 1 | No `import 'server-only'` guards on DB, scanner, importer, monitor, deluge, jackett, auth, extractor, ocr | `src/db/index.ts`, `src/lib/scanner.ts`, `src/lib/importer.ts`, `src/lib/monitor.ts`, `src/lib/deluge.ts`, `src/lib/jackett.ts`, `src/lib/extractor.ts`, `src/lib/ocr.ts`, `src/lib/auth.ts` | **High** — no compile-time protection against future leaks |
| 2 | `ocr-overlay.tsx` (`'use client'`) re-exports types from `@/lib/mokuro` which imports `fs` + `@/db` | `/Users/yoran/mangashelf/src/components/ocr-overlay.tsx` lines 4, 6 | **High** — one value-import from runtime crash |
| 3 | Reader library page (`/`) directly queries `managedManga`, `managedVolume` Manager tables | `/Users/yoran/mangashelf/src/app/page.tsx` lines 3–57 | **Medium** — tight cross-domain coupling |
| 4 | Reader manga detail page queries Manager tables (`managedManga`, `managedVolume`) | `/Users/yoran/mangashelf/src/app/manga/[id]/page.tsx` lines 5–100 | **Medium** — tight cross-domain coupling |
| 5 | `/api/delete/route.ts` is a cross-domain handler in the Reader namespace performing "cross-domain resolution" | `/Users/yoran/mangashelf/src/app/api/delete/route.ts` | **Medium** — Reader/Manager coupling, confusing namespace |
| 6 | `/api/downloads/status/route.ts` queries Manager tables from Reader API path | `/Users/yoran/mangashelf/src/app/api/downloads/status/route.ts` | **Low-Medium** — namespace confusion, not a breakage risk |
| 7 | `service-checks.ts` duplicates `DELUGE_URL`, `DELUGE_PASSWORD`, `JACKETT_URL`, `JACKETT_API_KEY` | `/Users/yoran/mangashelf/src/lib/system/service-checks.ts` lines 6–9 | **Low** — DRY violation, drift risk |
| 8 | `import/progress` route handler spans both domains (`managedManga`/`managedVolume` + `syncLibrary`) | `/Users/yoran/mangashelf/src/app/api/import/progress/[importId]/route.ts` | **Low** — intentional bridge, but undocumented boundary role |
| 9 | `lib/mokuro.ts` has no `import 'server-only'` guard despite using `fs` and `@/lib/ocr` | `/Users/yoran/mangashelf/src/lib/mokuro.ts` lines 1–2 | **Low** — safe today due to type-only imports from client side |
| ~~10~~ | ~~proxy.ts dead middleware~~ | retracted | Next.js 16 `proxy.ts` is canonical (see Section 4a) |
