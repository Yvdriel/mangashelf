# Manga-Reader Exploration Summary

Four reader flows explored as admin against the seeded Yotsuba fixture
(`tests/fixtures/manga/Yotsuba to! [anilist-30104]/v01`, 20 pages, mokuro
with OCR blocks on page 13). One plan per flow saved under this directory.

## Completion

| Flow | Status | Skipped sub-cases (and why) |
|------|--------|-----------------------------|
| 1 — Open a manga from the home page | clean | Empty-library edge state and zero-volume-manga edge state — both require a different fixture (or the seeded `manga`/`volume` rows deleted before the test). |
| 2 — Open a volume to start reading | clean | Volume-with-no-pages and mid-import-volume edge states — both need fixtures the current seed does not produce. |
| 3 — Scroll through the reader | clean | None deferred. Failure-to-load was simulated via `browser_route` 404-stubbing. |
| 4 — OCR overlay (multi-step) | clean | "Global ON but volume has no OCR" — needs a fixture volume whose `.mokuro` is either missing or has `blocks: []` for every page. Mid-exploration the session was invalidated twice and re-authenticated; not blocking but worth noting. |

## UI inconsistencies

- **OCR labelling mismatch.** Settings calls the toggle **"Japanese OCR overlays"**; the in-reader button is labelled just **"OCR"**. New users do not immediately connect the two. Specs should assert both labels verbatim so a rename in one place fails the spec on the other.
- **In-reader OCR button default state is non-obvious.** With the global setting enabled, opening a fresh reader shows the **"OCR"** button but no overlay — a second click is required. The button's tooltip changes between `Show OCR text` and `Hide OCR text` to convey state. Specs should assert the initial tooltip is `Show OCR text`.
- **Overlay nodes unmount entirely** when the in-reader toggle is off (not CSS-hidden). Good for accessibility — OCR text is never exposed to AT when the user has not opted in. Spec the unmount, not a `hidden` attribute.

## Overlap with existing plans

- `specs/discovered/admin/plan.md` **§7.8** ("OCR overlay toggle persists") and `specs/discovered/regular-user/plan.md` **§2.3** ("OCR overlay toggle triggers preference save") cover the settings-page toggle and the `PUT /api/user/preferences` call — they do **not** cover the in-reader button, the reader sliding window, or the per-page block-count behaviour. No deletions required in those plans.
- Neither the admin nor the regular-user plan exercises `/manga/[id]` populated render or `/manga/[id]/read/[volumeNumber]`. The four new files are the first reader-specific coverage in the discovered set.

## Useful internals discovered during exploration

- Reader uses a **sliding window of ~6 mounted `<img>` elements** at a time. All 20 page slots are present as outer `div`s from initial render; only the in-viewport ~6 have child `<img>` nodes. Earlier pages unmount as the window advances.
- Page progress writes to `PUT /api/progress/1/1` with `{ currentPage: N }` where `N` is **0-indexed**.
- The detail page's primary CTA reads **"Start Reading · Vol 1"** on a fresh manga and flips to **"Read Vol 1"** once any progress row exists for that manga.
- The detail-page back-link from inside the reader is the manga-title button (**"Yotsuba to!"** in the fixture).
