# Flow 3 — Scroll Through the Reader

## Application Overview

MangaShelf manga-reader flow: scrolling through all 20 pages of volume 1. Tests page loading behavior, page indicator updates, lazy-load windowing, and the end-of-volume state. Seed: tests/seed-admin.spec.ts. Entry: /manga/1/read/1. Fixture has 20 pages. Reader uses a sliding window of approximately 6 visible page images at a time.

## Test Scenarios

### 1. flow-3-scroll-reader

**Seed:** `tests/seed-admin.spec.ts`

#### 1.1. Initial page load renders first batch of pages

**File:** `tests/admin/manga-reader/flow-3/initial-load.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/manga/1/read/1
    - expect: The reader scrollable container (div.fixed.top-0.right-0.left-0.z-50.overflow-y-auto) is rendered
    - expect: The page indicator in the header reads 'Vol 1 · 1 / 20'
    - expect: The DOM contains exactly 20 page-slot divs (div.relative.w-full inside div.mx-auto.max-w-4xl) plus 1 end-of-volume footer div (21 children total)
    - expect: Exactly 6 img elements with alt texts 'Page 1' through 'Page 6' are rendered in the DOM; all have loading='lazy'
    - expect: Image srcs follow the pattern /api/manga/1/volume/1/page/{N} where N is 0-indexed (Page 1 = page/0, Page 6 = page/5)
    - expect: Page-slot divs 7–20 (indexes 6–19) contain no img elements — they are empty placeholder divs waiting for intersection
    - expect: GET /api/manga/1/volume/1/ocr is called on reader load (HTTP 200)
  2. Confirm the reader layout dimensions
    - expect: The scrollable container clientHeight is approximately 720px (or viewport height)
    - expect: The scrollable container scrollHeight is approximately 26000–37000px depending on page image sizes after load

#### 1.2. Scrolling progressively loads and unloads page images (sliding window)

**File:** `tests/admin/manga-reader/flow-3/lazy-load-window.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/manga/1/read/1. Using JavaScript, set the scrollable container's scrollTop to 18000 and wait 500ms.
    - expect: At least 6 new img elements are visible in the DOM, covering pages around the scroll position (e.g. Page 7 through Page 11 or similar)
    - expect: The page indicator updates to reflect the first fully-visible page in the viewport (e.g. 'Vol 1 · 6 / 20')
    - expect: Images that have scrolled fully out of view may be removed from the DOM (the window slides: earlier pages may disappear as later pages appear)
  2. Set scrollTop to a value that places page 13 (1-indexed, API page/12) in the viewport (approximately scrollTop 22000–24000) and wait 500ms.
    - expect: img elements for pages in the vicinity of page 13 are present in the DOM (e.g. 'Page 10' through 'Page 14' or similar window)
    - expect: The page indicator updates to a value near 'Vol 1 · 13 / 20'
    - expect: The img element for Page 13 has src /api/manga/1/volume/1/page/12
  3. Scroll to the very end (scrollTop = max, e.g. 26176) and wait 500ms.
    - expect: The page indicator reads 'Vol 1 · 20 / 20'
    - expect: img elements for Pages 15–20 are present in the DOM
    - expect: The 'End of Volume 1' footer section is visible: paragraph 'End of Volume 1', paragraph 'You’ve reached the last volume.', and 'Back to details' button are all visible
  4. Note: scrolling past the end (beyond max scrollHeight) is not possible — the browser clamps scrollTop to the maximum scrollable value. The 'End of Volume 1' footer is always the final content and serves as the visual 'past the end' state.

#### 1.3. Page indicator updates in real time during scroll

**File:** `tests/admin/manga-reader/flow-3/page-indicator-updates.spec.ts`

**Steps:**
  1. Navigate to /manga/1/read/1. Record the initial indicator ('Vol 1 · 1 / 20'). Gradually set scrollTop through several steps (0, 5000, 10000, 15000, 20000, max) with 200ms pauses between each step.
    - expect: At scrollTop 0: indicator is 'Vol 1 · 1 / 20'
    - expect: At scrollTop ≈18000: indicator has advanced to 'Vol 1 · 6 / 20' or higher
    - expect: At scrollTop ≈22000–24000: indicator shows page 13–19
    - expect: At scrollTop max: indicator shows 'Vol 1 · 20 / 20'
    - expect: The indicator format is always 'Vol {volumeNumber} · {currentPage} / {totalPages}'
  2. Reading progress is saved via network on scroll
    - expect: PUT /api/progress/1/1 is called with body {currentPage: N} where N is the 0-indexed last-seen page number
    - expect: Response is HTTP 200
    - expect: The progress call reflects the furthest page reached during the scroll session

#### 1.4. End-of-volume 'Back to details' button returns to manga detail

**File:** `tests/admin/manga-reader/flow-3/back-to-details-button.spec.ts`

**Steps:**
  1. Navigate to /manga/1/read/1. Scroll to the end of the volume (scrollTop = max). Click the 'Back to details' button in the end-of-volume footer.
    - expect: URL changes to http://localhost:3100/manga/1
    - expect: Manga detail page is rendered with heading 'Yotsuba to!' and Volumes section
    - expect: Volume 1 card shows 'Completed' read status (since all 20 pages were viewed)
  2. Note: the following edge states require different fixtures and cannot be reproduced with seed-admin:
    - expect: Long-volume lazy-load behaviour with more than 20 pages — the fixture has exactly 20 pages; testing with 100+ pages would require a larger fixture
    - expect: A page that fails to load can be simulated by route-intercepting /api/manga/1/volume/1/page/N to return HTTP 404. The expected outcome is that the placeholder div remains empty (broken image or empty space) while surrounding pages continue to load. This is not tested in the seeded state.
    - expect: Returning to a previous scroll position after navigating away — the reader does NOT persist scroll position; returning via the detail page always starts at page 1 (or the saved progress page if the reading position is restored from the API)
