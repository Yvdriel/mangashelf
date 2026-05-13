# Flow 1 — Open a Manga from the Home Page

## Application Overview

MangaShelf manga-reader flow: navigating from the home-page library grid to a manga detail page as admin. Seed: tests/seed-admin.spec.ts. Pre-seeded state: one manga (Yotsuba to!, manga.id=1) with one volume (v01, 20 pages). Admin session (playwright/.auth/user.json) is used throughout.

## Test Scenarios

### 1. flow-1-open-manga-from-home

**Seed:** `tests/seed-admin.spec.ts`

#### 1.1. Home page loads library grid with manga cards

**File:** `tests/admin/manga-reader/flow-1/home-page-library-grid.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/
    - expect: URL is http://localhost:3100/
    - expect: Page title is 'MangaShelf'
    - expect: Heading 'Library' (h1) is visible
    - expect: Sort combobox is visible with default option 'Title'
    - expect: Search textbox 'Search...' is visible
    - expect: 'Select' button is visible (admin-only)
    - expect: Genre filter chips 'Comedy' and 'Slice of Life' are visible above the card grid
  2. Observe the manga card grid
    - expect: A link/card labelled 'Yotsuba to! Yotsuba to! 1 volume' is visible
    - expect: The card contains a cover image with alt text 'Yotsuba to!'
    - expect: The card heading reads 'Yotsuba to!'
    - expect: The card sub-text reads '1 volume'
    - expect: The card href is /manga/1
  3. Observe the absence of any empty-state message
    - expect: The text 'No manga found.' is NOT shown
    - expect: The genre chips confirm metadata was loaded from AniList (Comedy, Slice of Life badges)
  4. Note: to reproduce the empty-state (heading 'No manga found.' + hint 'Place manga folders in your MANGA_DIR and click Scan Library.'), a fixture with zero manga rows is required — this cannot be tested with the seed-admin fixture.

#### 1.2. Click manga card to reach the detail page

**File:** `tests/admin/manga-reader/flow-1/click-card-to-detail.spec.ts`

**Steps:**
  1. Navigate to http://localhost:3100/ and click the 'Yotsuba to! Yotsuba to! 1 volume' card link
    - expect: URL changes to http://localhost:3100/manga/1
    - expect: Page title is 'MangaShelf'
    - expect: Heading 'Yotsuba to!' (h1) is visible
    - expect: Sub-heading 'by Kiyohiko Azuma' is visible
    - expect: Status chip 'Releasing' is visible
    - expect: Score chip '★ 88%' is visible
    - expect: Reading-progress chip 'Not started · 0/1 volumes' is visible on first visit (or 'Reading · 1/1 volumes' if reading progress has been recorded)
    - expect: Genre chips 'Comedy' and 'Slice of Life' are visible
  2. Observe the action buttons below the cover image
    - expect: A link/button labelled 'Start Reading · Vol 1' (on first visit) or 'Read Vol 1' (when reading progress exists) is visible, pointing to /manga/1/read/1
    - expect: A button 'OCR'ing 0/1 · 1 queued' (or similar OCR status) is present, indicating background OCR processing status for the volume
    - expect: A 'Delete' button is visible (admin-only)
  3. Observe the detail page body sections
    - expect: Heading 'Synopsis' (h2) is visible with the manga synopsis paragraph
    - expect: A 'Show more' button is visible to expand the synopsis
    - expect: Heading 'Volumes' (h2) is visible
  4. Observe the volume list under 'Volumes'
    - expect: A link/card for 'Volume 1' is visible with href /manga/1/read/1
    - expect: The volume card shows '20 pages'
    - expect: The volume card shows an OCR status badge ('OCR…' indicating mokuro processing is pending or complete)
    - expect: The volume card shows a read status: 'Unread' on first visit, 'Completed' once all pages have been viewed
  5. Note: a manga detail page with zero volumes ('needs zero-volume fixture') cannot be reproduced in this seeded environment. Such a page would need a manga row with no corresponding volume rows.
    - expect: The 'Volumes' section would show an empty list or an explicit 'No volumes yet.' message — exact text not verified
  6. Navigate back to http://localhost:3100/ using the browser back button or the 'Library' nav link
    - expect: URL returns to /
    - expect: Library heading is visible
    - expect: Manga card grid is visible
    - expect: Sort and search state may reset to default 'Title' sort (client-side sort/filter is not preserved in URL query params — state is not persisted across full navigations)
