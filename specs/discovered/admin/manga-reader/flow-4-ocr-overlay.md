# Flow 4 — OCR Overlay (Multi-Step)

## Application Overview

MangaShelf manga-reader OCR overlay flow. Two OCR controls exist: (1) global preference 'Japanese OCR overlays' at /settings/account (Reader section), (2) in-reader button labelled 'OCR' in the reader toolbar. The global setting gates the in-reader button: when global OCR is OFF the 'OCR' button is completely absent from the reader DOM; when ON the button appears. The in-reader OCR button is a separate toggle: clicking it once shows overlays (title changes to 'Hide OCR text', button gets accent styling); clicking again hides overlays (title reverts to 'Show OCR text', button reverts to neutral styling). OCR overlays are implemented as absolutely-positioned div containers over each page image, mounted/unmounted from the DOM based on the in-reader toggle state. Seed: tests/seed-admin.spec.ts. Pre-seeded: v01.mokuro OCR data present. /api/manga/1/volume/1/ocr returns 20 pages; pages at 0-indexes 6 and 9 (UI Pages 7 and 10) have zero OCR blocks; all other pages have one or more blocks. Page at 0-index 12 (UI Page 13) has 4 OCR blocks.

## Test Scenarios

### 1. flow-4-ocr-overlay

**Seed:** `tests/seed-admin.spec.ts`

#### 1.1. Step A — Enable global OCR in /settings/account and verify PUT fires

**File:** `tests/admin/manga-reader/flow-4/enable-global-ocr.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/settings/account
    - expect: Heading 'Account Settings' (h1) is visible
    - expect: Section 'Reader' (h2) is visible
    - expect: A switch labelled 'Japanese OCR overlays' is visible in the Reader section (the global OCR setting)
    - expect: The description under the switch mentions Yomitan and mokuro links
    - expect: The switch aria-checked value reflects the current saved preference (default is 'false' / unchecked in a clean session)
  2. If the 'Japanese OCR overlays' switch is currently OFF (aria-checked='false'), click it to enable
    - expect: PUT /api/user/preferences is called with request body {"ocrEnabled":true}
    - expect: Response status is 200 OK
    - expect: Response body contains ocrEnabled: true and all other preferences unchanged
    - expect: The switch visually changes to checked state (aria-checked='true')
  3. Note: the global setting label 'Japanese OCR overlays' differs from the in-reader button label 'OCR'. The global setting has a descriptive paragraph; the in-reader control is a compact unlabelled button with a tooltip.

#### 1.2. Step B — Open volume in reader, confirm in-reader OCR button is present when global OCR is ON

**File:** `tests/admin/manga-reader/flow-4/reader-ocr-button-present.spec.ts`

**Steps:**
  1. With global OCR enabled (ocrEnabled: true in preferences), navigate to http://localhost:3100/manga/1 and click 'Start Reading · Vol 1' or 'Read Vol 1' to open the reader at /manga/1/read/1
    - expect: URL is /manga/1/read/1
    - expect: The reader header contains three controls: the 'Yotsuba to!' back button (left), the 'OCR' button, and the 'Vol 1 · N / 20' page indicator (right)
    - expect: The 'OCR' button is visible with label 'OCR' and tooltip/title 'Show OCR text'
    - expect: The 'OCR' button has neutral styling (border-surface-500, text-surface-300 classes — not highlighted)
    - expect: The button is NOT in an [active] accessibility state on initial load
    - expect: OCR text overlays are NOT rendered in the page-slot divs on initial load (div.pointer-events-none.absolute.inset-0 is absent from each page slot's inner div)
  2. GET /api/manga/1/volume/1/ocr is called on reader load
    - expect: Response is HTTP 200
    - expect: Response body has structure {pages: [...], ...} with 20 page entries
    - expect: Page at index 0 has blocks.length >= 1
    - expect: Page at index 12 (UI Page 13) has exactly 4 blocks
    - expect: Pages at indexes 6 and 9 (UI Pages 7 and 10) have exactly 0 blocks

#### 1.3. Step C — Click in-reader OCR button to show overlays

**File:** `tests/admin/manga-reader/flow-4/click-ocr-button-show-overlays.spec.ts`

**Steps:**
  1. With the reader open at /manga/1/read/1 and global OCR ON, click the 'OCR' button in the reader header
    - expect: The button title/tooltip changes from 'Show OCR text' to 'Hide OCR text'
    - expect: The button enters the [active] accessibility state
    - expect: The button styling changes to accent colors (border-accent-400, bg-accent-400/15, text-accent-200)
    - expect: For each page slot that has a loaded img element, a new div.pointer-events-none.absolute.inset-0 is mounted as a sibling to the img inside div.relative.w-full
    - expect: The OCR overlay divs contain nested div elements representing individual text blocks from the mokuro OCR data
    - expect: Pages 7 and 10 (0-indexes 6 and 9) will have an overlay div that contains no child block divs (empty overlay layer)
    - expect: The overlays are pointer-events-none so they do not block image scrolling or clicking through to the underlying page image
    - expect: Performance note: overlay enable feels near-instantaneous as the OCR data was already fetched on reader load; no additional network request is triggered by clicking the in-reader OCR button
  2. Click the 'OCR' button again to hide overlays
    - expect: The button title reverts to 'Show OCR text'
    - expect: The button leaves the [active] accessibility state
    - expect: The button styling reverts to neutral (border-surface-500, text-surface-300)
    - expect: All div.pointer-events-none.absolute.inset-0 overlay divs are removed from the DOM (unmounted, not merely hidden via CSS)
    - expect: Page images are fully visible without any overlay layer

#### 1.4. Step D — Scroll to page 13 and verify 4 OCR blocks are rendered

**File:** `tests/admin/manga-reader/flow-4/page-13-ocr-blocks.spec.ts`

**Steps:**
  1. With the reader at /manga/1/read/1, global OCR ON, and in-reader OCR toggled ON (button title = 'Hide OCR text'), scroll the reader container to bring page 13 (alt='Page 13') into the viewport. Approximate scrollTop: 22000–24000 on a standard viewport.
    - expect: img with alt='Page 13' is present in the DOM with src /api/manga/1/volume/1/page/12
    - expect: The page-slot div containing 'Page 13' has a sibling div.pointer-events-none.absolute.inset-0 overlay
    - expect: The overlay contains exactly 4 child block div elements (corresponding to the 4 OCR blocks at page index 12 in the OCR data)
    - expect: Each block div is positioned absolutely within the overlay and contains the selectable Japanese text from that text region
    - expect: The page indicator shows approximately 'Vol 1 · 13 / 20'
  2. Verify the OCR data endpoint directly
    - expect: GET /api/manga/1/volume/1/ocr returns HTTP 200
    - expect: Response JSON structure: {pages: [{blocks: [...]}, ...]}
    - expect: pages[12].blocks.length === 4
    - expect: pages[6].blocks.length === 0 (Page 7 has no OCR text)
    - expect: pages[9].blocks.length === 0 (Page 10 has no OCR text)
    - expect: All other pages have blocks.length >= 1
  3. Toggle OCR off by clicking the 'OCR' button while page 13 is in view
    - expect: The overlay div for page 13 is removed from the DOM
    - expect: The img 'Page 13' remains fully visible and unaffected
    - expect: The page indicator stays at the same position

#### 1.5. Edge state — Global OCR OFF: in-reader OCR button is absent

**File:** `tests/admin/manga-reader/flow-4/global-ocr-off-no-button.spec.ts`

**Steps:**
  1. Navigate to /settings/account and disable the 'Japanese OCR overlays' switch (set to unchecked / aria-checked='false')
    - expect: PUT /api/user/preferences is called with request body {"ocrEnabled":false}
    - expect: Response status is 200 OK
    - expect: The switch visually changes to unchecked state
  2. Navigate to /manga/1/read/1
    - expect: The reader loads normally at /manga/1/read/1
    - expect: The reader header contains only the 'Yotsuba to!' back button and the 'Vol 1 · N / 20' page indicator
    - expect: NO 'OCR' button is present in the reader header — it is completely absent from the DOM (not hidden, not disabled, simply not rendered)
    - expect: No OCR overlay divs are rendered on any page
  3. Note: the edge state 'Global OCR ON but volume has no OCR data file' cannot be reproduced in this fixture. In that scenario, the in-reader OCR button would likely appear but clicking it would show empty overlays (zero blocks on all pages). A separate fixture with a volume having no corresponding .mokuro file is required to test this path.

#### 1.6. Persistence check — close and reopen reader with OCR preference

**File:** `tests/admin/manga-reader/flow-4/ocr-preference-persistence.spec.ts`

**Steps:**
  1. Enable global OCR in /settings/account. Open the reader at /manga/1/read/1. Click the 'OCR' button to show overlays (title = 'Hide OCR text'). Navigate back to /manga/1 via the 'Yotsuba to!' back button. Reopen the reader by clicking 'Read Vol 1'.
    - expect: On re-opening the reader, URL is /manga/1/read/1
    - expect: The 'OCR' button is present in the reader header (global preference is still ON — it persists across page navigations via the preferences API)
    - expect: The in-reader OCR overlay is NOT active by default on re-open (title = 'Show OCR text', overlays absent from DOM) — the in-reader toggle state is local to the reader session and does not persist
    - expect: GET /api/user/preferences is called on reader mount and ocrEnabled: true is returned, which causes the OCR button to be rendered
