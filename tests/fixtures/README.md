# E2E Manga Fixtures

`tests/global-setup.ts` copies the contents of `tests/fixtures/manga/` into
`.test-data/manga/` on every Playwright run, then `tests/auth.setup.ts`
calls `POST /api/library/scan` so the DB picks up whatever is on disk.

Drop your own manga files here. Nothing in `manga/<title>/v*/` is
committed beyond the directory stubs — supply your own pages.

## Required layout

```
tests/fixtures/manga/
  <Title> [anilist-<id>]/
    v01/
      001.jpg
      002.jpg
      …
    v01.mokuro            # OCR JSON sibling of the volume folder
    v02/
      001.jpg
      …
    v02.mokuro
```

- Folder name must end with `[anilist-<numericId>]` so the scanner can
  link it to managed-manga records (see `CLAUDE.md`).
- Page files must be `.jpg`, `.jpeg`, `.png`, or `.webp`, numerically named.
- Volume folders are case-insensitive `v01`, `v02`, …

## The `.mokuro` file shape

One JSON file per volume, sibling of the volume directory
(`v01.mokuro` for `v01/`). Shape from `src/lib/mokuro.ts`:

```ts
interface MokuroFile {
  version?: string;
  title?: string;
  volume?: string;
  pages: MokuroPage[];        // one entry per page file in order
}

interface MokuroPage {
  img_width: number;
  img_height: number;
  img_path?: string;          // relative to the .mokuro file
  blocks: MokuroBlock[];
}

interface MokuroBlock {
  box: [number, number, number, number];   // x1, y1, x2, y2 (px)
  vertical: boolean;
  font_size: number;
  lines: string[];            // OCR text, one entry per text line
}
```

The OCR overlay, text-view pages, and Anki-capture flows all read this
file. Without it, `loadMokuroFile()` returns `null` and the OCR routes
return empty payloads — half the reader feature surface stays untested.

## Recommended seed: Yotsuba&! v01

A single volume is enough to spec:

- `/manga/[id]` populated render
- `/manga/[id]/read/[volumeNumber]` reader with hotkeys + progress write
- `/manga/[id]/text` and `/manga/[id]/volume/[volumeNumber]/text` OCR views
- `/api/anki/capture` page-region crop
- `PUT /api/progress/[mangaId]/[volumeId]` resume + `isCompleted` flip

10 pages is plenty. Generate the `.mokuro` with the upstream `mokuro`
CLI against the same 10 pages so coordinates match.

`Yotsuba to! [anilist-30104]/` already exists as the canonical seed slot.
Drop `v01/001.jpg…010.jpg` + `v01.mokuro` into it.

## Why this lives in the repo

Without a persistent fixture, every test boots against an empty library.
Roughly half of the Reader and OCR surface is unreachable in that state
(see `tests/FLOWS.md` §2.B). Committing one real volume gives every flow
a deterministic starting point with no per-run download cost.

Files in `tests/fixtures/manga/<title>/v*/` are **not** committed; only
the directory stubs and this README. Keep your local fixture there and
it will be picked up automatically.
