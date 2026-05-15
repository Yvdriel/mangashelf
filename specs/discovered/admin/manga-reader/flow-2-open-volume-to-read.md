# Flow 2 — Open a Volume to Start Reading

## Application Overview

MangaShelf manga-reader flow: opening a volume from the manga detail page to start reading. Entry point is /manga/1. The reader opens at /manga/1/read/1. Seed: tests/seed-admin.spec.ts. Pre-seeded: manga.id=1 (Yotsuba to!), volume v01 with 20 pages, progress tracked via PUT /api/progress/1/1.

## Test Scenarios

### 1. flow-2-open-volume-to-read

**Seed:** `tests/seed-admin.spec.ts`

#### 1.1. Open volume from the detail page using the primary CTA button

**File:** `tests/admin/manga-reader/flow-2/open-volume-via-cta.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/manga/1
    - expect: URL is /manga/1
    - expect: Heading 'Yotsuba to!' (h1) is visible
    - expect: A link labelled 'Start Reading · Vol 1' (first visit) or 'Read Vol 1' (returning visit) with href /manga/1/read/1 is visible in the action bar below the cover image
  2. Click the 'Start Reading · Vol 1' (or 'Read Vol 1') link
    - expect: URL changes to http://localhost:3100/manga/1/read/1
    - expect: Page title is 'MangaShelf'
    - expect: The reader overlay renders as a fixed full-screen container (div.fixed.top-0.right-0.left-0.z-50.overflow-y-auto) covering the viewport
  3. Observe the reader header/toolbar at the top of the reader container
    - expect: A button labelled 'Yotsuba to!' (with a back-arrow icon) is visible in the top-left of the reader header — this is the breadcrumb/back navigation button
    - expect: A page indicator text 'Vol 1 · 1 / 20' is visible in the top-right of the reader header, showing the current page and total page count
    - expect: No 'OCR' button is present in the header when the global 'Japanese OCR overlays' preference is OFF (GET /api/user/preferences returned ocrEnabled:false)
  4. Observe the first page image
    - expect: An image with alt text 'Page 1' is rendered in the reader scroll container
    - expect: The image src is /api/manga/1/volume/1/page/0 (0-indexed page number)
    - expect: The image has loading='lazy'
    - expect: Pages 2–6 (alt texts 'Page 2' through 'Page 6') are also rendered in the initial viewport batch
  5. Observe the end-of-volume footer
    - expect: Below all page slots, a section with paragraph 'End of Volume 1' and paragraph 'You’ve reached the last volume.' is rendered in the DOM (may not be visible until scrolled to)
    - expect: A 'Back to details' button is present in this footer section
  6. Verify the reading progress API is called on load
    - expect: PUT /api/progress/1/1 is called with body {currentPage: N} where N is the 0-indexed last-read page
    - expect: Response is HTTP 200
  7. Note: edge states that require different fixtures:
    - expect: Volume with no pages — requires a fixture with a volume row where page_count=0. The reader URL /manga/1/read/1 would still load but would show zero page slots and immediately show the end-of-volume footer.
    - expect: Mid-import volume — requires a fixture with a volume in 'importing' state. Cannot be reproduced in this seeded env.
    - expect: Volume for a non-existent manga — navigate to /manga/999999/read/1. Expect: 404 page rendered.
  8. Verify the volume card entry point on the detail page also opens the reader
    - expect: On /manga/1, clicking the 'Volume 1 20 pages OCR… Unread' link card (href /manga/1/read/1) navigates to the same reader URL
    - expect: Both the top CTA button and the volume card link are equivalent entry points

#### 1.2. Open volume from the volume list card

**File:** `tests/admin/manga-reader/flow-2/open-volume-via-card.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/manga/1 and click the 'Volume 1 20 pages OCR…' volume card link in the Volumes section
    - expect: URL changes to http://localhost:3100/manga/1/read/1
    - expect: Reader overlay is rendered with 'Vol 1 · N / 20' page indicator where N corresponds to the last saved page (or 1 if no progress)
  2. Navigate back to /manga/1 using the 'Yotsuba to!' back button in the reader header
    - expect: URL changes back to http://localhost:3100/manga/1
    - expect: Manga detail page is displayed with cover, title, volumes section
