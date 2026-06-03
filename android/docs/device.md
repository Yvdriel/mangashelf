# Mudita Kompakt — Device Specs (CH.1 · item 0.4)

Research-only engineering reference for the **real** Mudita Kompakt. Gates reader
tap-zones (4.2/4.3), the e-ink ghosting strategy (6.1), and font bundling across
all pillars (reader / flashcard / dict).

Confidence legend: **confirmed** (official Mudita doc or hands-on review) ·
**likely** (multiple secondary sources agree, no contradiction) · **unknown**
(only verifiable on real hardware — see Open Questions).

App context (this repo, `android/app/build.gradle.kts`): `minSdk 28`, `targetSdk 35`,
`compileSdk 35`, single arm64-v8a ABI, Compose + Material3 `1.3.1`, Compose compiler
`1.5.10`, Kotlin `1.9.22`, `com.mudita:MMD:1.0.0`. This matrix is pinned to the
MMD-1.0.0-proven stack from the KompaktCalendar reference app.

---

## TL;DR

| Axis | Value | Confidence |
|---|---|---|
| Input | Capacitive touchscreen (primary). Physical volume rocker + power/fingerprint button + left Offline+ switch. Capacitive back/home/settings nav strip. **No D-pad, no dedicated page-turn keys.** | confirmed (touch + buttons); app key-interception **unknown** |
| E-ink refresh API | **None for a stock AOSP app.** No public waveform/full-flash control. MMD `1.0.0` ships zero refresh API — its "e-ink" support is visual (monochrome theme) + app-side paginated scrolling only. | confirmed (MMD AAR), likely (OS) |
| Screen | 4.3" E Ink, **800 × 480 px**, ~216–217 ppi | confirmed |
| Density bucket | Nearest = **hdpi (240, density 1.5)** → ~533 × 320 dp. Exact reported `densityDpi` unknown. | likely (px+size); bucket unknown |
| CJK font | System font is Lato (Latin/LGC only). **Bundling Noto Sans JP is mandatory** for any Japanese text. | confirmed (Lato), likely (no system CJK) |
| MMD inventory | 23 component groups, monochrome e-ink M3 wrappers. Has progress bars + lazy lists. Missing: image-list row, async image, pager. | confirmed (AAR) |

---

## 1. Input model — touch / D-pad / hardware keys

**Verdict: design the reader for TOUCH tap-zones + swipe. Treat hardware keys as a
bonus we cannot rely on.**

- **Capacitive touchscreen** is the primary input — 4.3" 800×480 E Ink touch panel.
  *(confirmed — Mudita technical specs page lists "4.3" E-ink touchscreen"; hands-on
  reviews describe touch + haptics.)*
- **Physical buttons present:**
  - Power button with integrated fingerprint reader (right side). *(confirmed)*
  - **Volume rocker** — physical, "clicky". *(confirmed — review hands-on)*
  - Left-side **Offline+ hardware switch** — cuts all radios at HW level; not an
    app-facing input. *(confirmed)*
- **Capacitive nav strip** along the bottom: back / home / settings. These are
  OS-level navigation (settings button = volume/brightness/quick toggles), **not
  app-remappable**. *(confirmed — review + quick-start guide)*
- **No D-pad / trackball / focus-ring hardware.** No dedicated e-reader page-turn
  keys. *(likely — absent from every spec sheet and review.)*

**Reference-app evidence:** the MMD reference app `KompaktCalendar` is *entirely*
touch-driven — `Modifier.clickable`, `pointerInput` + `detectVerticalDragGestures` /
horizontal swipe. It contains **zero** `onKeyEvent` / `onPreviewKeyEvent` /
`KEYCODE_*` / D-pad focus handling. That is the idiomatic MMD input pattern and what
we should mirror.

**Reader implication (4.2/4.3):** tap-zones are the source of truth. Left/right
(or, for RTL manga, right/left) tap halves for prev/next page, plus a center tap for
chrome. Swipe as secondary. Do **not** require hardware keys for navigation.

**Volume-key page-turn (the tempting optimization):** the keys are physical, so in
stock AOSP an app can normally intercept `KEYCODE_VOLUME_UP/DOWN` via
`Activity.onKeyDown`/Compose `onKeyEvent`. Whether MuditaOS K lets a sideloaded app
consume them (vs. the OS swallowing them for volume) is **unknown** — see Open
Questions. Ship tap-zones first; treat volume-key turning as a progressive
enhancement guarded behind a runtime capability check.

---

## 2. E-ink refresh / full-flash control API

**Verdict: a stock AOSP app on the Kompakt gets NO e-ink refresh API. Plan the
ghosting strategy entirely at the app layer.** *(confirmed for MMD; likely for OS.)*

Findings:
- **MMD `1.0.0` exposes no refresh/waveform/EPD API whatsoever.** Decompiling
  `mmd-core-release.aar` → `classes.jar`: a full-jar scan for
  `refresh|waveform|epd|eink|ghost` class names returns **nothing**. The only
  "e-ink" surface is **visual**:
  - `com.mudita.mmd.eInkColorScheme` — a Material3 `ColorScheme` (pure black/white
    monochrome).
  - `com.mudita.mmd.eInkTypography` — high-contrast `Typography`.
  - `com.mudita.mmd.ThemeMMD(colorScheme, typography, content)` — wires those in and
    disables ripple/motion by default.
  None of these touch the panel driver.
- **MuditaOS K = "custom de-Googled AOSP"** (official spec page), based on **AOSP 12
  / Android 12** (secondary sources). E-ink waveform/refresh control on this class of
  device (Onyx/Tolino/Boox-style `Eink*` SDKs, MTK EPD HALs) is a **vendor
  extension**, not part of stock AOSP. Mudita publishes **no app-facing display SDK**
  and explicitly states sideloaded apps "are not optimized for Kompakt's unique E Ink
  screen and may not always work as intended" — i.e. **no public refresh hook for
  third-party apps.** *(confirmed Mudita statement; absence-of-API = likely.)*
- **How MMD/KompaktCalendar actually fight ghosting** (this is the pattern to copy):
  they avoid continuous smooth-scroll. `KompaktCalendar/ui/ScrollComponents.kt`
  implements `Modifier.eInkVerticalScroll` that **jumps `SCROLL_STEP` (4) items at a
  time via `state.scrollToItem(...)`** instead of pixel-smooth scrolling, paired with
  an `EInkScrollbar` of up/down page buttons. Discrete, full-page repaints — no
  partial-update animation. MMD's own `LazyColumnMMD` exposes a built-in
  `VerticalScrollbar` in the same spirit.

**6.1 ghosting strategy (recommended, app-layer only):**
- Pure black-on-white, no greys/gradients/AA-heavy UI; lean on `eInkColorScheme`.
- **Paginated reader** (whole-page swap per tap) — never continuous-scroll the manga
  page. Each page turn is one full repaint, which the panel handles as a clean A2/full
  refresh on its own.
- No animations/transitions/ripple (MMD already disables these).
- For long lists (library, flashcard deck, dict results) use discrete
  `scrollToItem` jumps like the reference app, not fling scrolling.
- Accept residual ghosting as unavoidable without a vendor API; do **not** design any
  feature that depends on forcing a full-flash.

---

## 3. Screen px + DPI / density

| Property | Value | Confidence |
|---|---|---|
| Panel | 4.3" E Ink, capacitive touch | confirmed |
| Resolution | **800 × 480 px** | confirmed |
| Pixel density | ~**216–217 ppi** (√(800²+480²)/4.3 ≈ 217) | confirmed (px+size); ppi computed |
| Nearest density bucket | **hdpi** (240 dpi, density **1.5**) | likely |
| Logical size @ hdpi | ≈ **533 × 320 dp** (portrait) | computed |

Notes:
- 217 ppi sits between mdpi (160) and hdpi (240); Android rounds to the nearest
  bucket, so **hdpi (1.5×)** is the most probable `densityDpi`, giving ~533×320 dp of
  layout space. **The vendor may set a non-standard `densityDpi`** (e-ink devices
  often do, e.g. 212/220) — the *exact* reported density is **unknown** until read
  from a real device. Design responsively; don't hard-code dp assuming a bucket.
- This is a **small, low-DP canvas** (~320 dp wide). Reader chrome must be minimal;
  list rows and tap targets need ≥48 dp but the screen only fits ~6 such rows tall.

---

## 4. CJK font inventory

**Verdict: bundling Noto Sans JP (or Source Han Sans JP) in the app is MANDATORY for
Japanese reader UI text, flashcard fronts/backs, and dictionary entries.**

- **System / MMD font is Lato — Latin (LGC) only.** The MMD AAR ships *only* Lato
  TTFs (`res/font/lato_*.ttf`: thin→black + italics) and **no Noto / no CJK** font of
  any kind. *(confirmed — AAR `res/font/` + `R.txt`.)* Lato has no Japanese/Chinese
  glyphs, so JP text under the MMD theme renders as **tofu (□)**.
- **Whether MuditaOS K's framework ships a system CJK fallback** (`NotoSansCJK` in
  `/system/fonts`, as full AOSP does) is **unknown** — it's a "de-Googled" minimal
  AOSP and may have stripped it. *(likely stripped or partial; verify on device.)*
- **Decision:** do not rely on a system fallback. **Bundle Noto Sans JP** as an app
  font resource and build an explicit Compose `FontFamily` fallback chain (Lato for
  Latin UI → Noto Sans JP for JP). This guarantees correct rendering regardless of
  what MuditaOS includes, and is required for the manga-text / vocab / dict pillars
  that are inherently Japanese.
  - Cost: Noto Sans JP subset is large (~1.5–6 MB depending on subset). Subset to the
    needed JIS/jōyō + kana range to keep APK size sane on a 32 GB device.
  - Note: MMD's `TextMMD` accepts a `fontFamily` param, so the CJK family can be
    threaded through MMD text components.

### Font scaling behaviour
- MMD `TextMMD` is a thin Compose `Text` wrapper using sp units; it honours Compose's
  font scaling, which reads the OS `fontScale`. *(confirmed from API shape.)*
- Whether MuditaOS K **exposes a user font-size setting** (and its range) is
  **unknown**. The Kompakt "settings" quick-button suggests display options exist but
  font-scale range is unverified. *(unknown — device pass.)*
- Reader implication: manga pages are **images**, so OS font scaling does not affect
  page rendering — only our chrome/overlays (page counter, dict popups, flashcard
  text). Test layouts at `fontScale` 1.0 and 1.3+ so larger system text doesn't clip
  the ~320 dp-wide UI. Use sp for text, dp for image/tap-zone geometry.

---

## 5. MMD component inventory (`com.mudita:MMD:1.0.0`)

Extracted from the cached AAR
(`~/.gradle/.../com.mudita/MMD-android/1.0.0/mmd-core-release.aar` →
`classes.jar`). Package `com.mudita.mmd.components.*`. All are **monochrome,
ripple-free, e-ink-styled Material3 wrappers** (suffix `MMD`).

**Top-level theme/util (`com.mudita.mmd.*`):** `ThemeMMD`, `eInkColorScheme`,
`eInkTypography`, `getBlack`/`getWhite` (ColorMMD), TypographyMMD.

**23 component groups:**

| Group | Primary composable(s) |
|---|---|
| `badge` | `BadgeMMD`, `BadgedBoxMMD` |
| `bottom_sheet` | `ModalBottomSheetMMD`, `SheetStateMMD` |
| `buttons` | `ButtonMMD`, `FloatingActionButtonMMD`, small FAB |
| `cards` | `CardMMD` (+ CardColors/Elevation/Defaults) |
| `checkbox` | `CheckboxMMD` |
| `chips` | `ChipMMD`, `InputChipMMD`, filter/assist/suggestion chip defaults |
| `divider` | `HorizontalDividerMMD` (+ DividerDefaults) |
| `lazy` | `LazyColumnMMD`, `LazyRowMMD`, built-in `VerticalScrollbar` |
| `menus` | `DropdownMenuMMD`, `DropdownMenuItemMMD` |
| `nav_bar` | `NavigationBottomBarMMD` (+ item defaults) |
| `progress_indicator` | `LinearProgressIndicatorMMD`, `CircularProgressIndicatorMMD` |
| `radio_button` | `RadioButtonMMD` |
| `search_bar` | `SearchBarMMD` (+ predictive-back support) |
| `slider` | `SliderMMD` (+ SliderStateMMD) |
| `snackbar` | `SnackbarMMD`, `SnackbarHostMMD`, host state |
| `switcher` | `SwitchMMD` |
| `tabs` | `TabMMD`, `TabsMMD` (+ tab-row defaults, scrollable) |
| `text` | `TextMMD` (String + AnnotatedString overloads; takes fontFamily) |
| `text_field` | `TextFieldMMD` (+ defaults/colors) |
| `time` | `DatePickerMMD`, `TimeInputMMD` |
| `tooltip` | `TooltipBoxMMD`, plain tooltip |
| `top_app_bar` | `TopAppBarMMD` |

**Cross-checked against KompaktCalendar usage** (`com.mudita.*` imports actually
compiled): `ButtonMMD`, `FloatingActionButtonMMD`, `HorizontalDividerMMD`,
`DropdownMenuMMD`/`DropdownMenuItemMMD`, `RadioButtonMMD`, `SwitchMMD`, `TextMMD`,
`TopAppBarMMD`, plus `ThemeMMD` / `eInkColorScheme` / `eInkTypography`. Confirms these
are stable and the intended building blocks.

**Have what we need:** progress bars **exist** (`LinearProgressIndicatorMMD` for
download/import progress; `CircularProgressIndicatorMMD`), lazy lists exist
(`LazyColumnMMD` + scrollbar) for library/deck/dict, plus search bar, chips, cards,
tabs, bottom sheet, nav bar — covers the reader/manager/flashcard/dict shells.

**Obviously-missing — substitute with Material3 + e-ink styling:**
- **No image / async-image component.** The reader page surface, cover thumbnails,
  and library grid tiles must be built from Compose `Image` + an image loader (e.g.
  Coil) under the MMD theme. MMD is text/forms-oriented, not media.
- **No "image list row" / rich list-item.** Library and search rows
  (cover + title + meta) must be hand-composed (`CardMMD`/`Row` + our own `Image`).
- **No pager / HorizontalPager.** The paginated reader must use Compose Foundation
  `HorizontalPager` (or manual page-swap) styled mono — MMD has no pager.
- **No grid (`LazyVerticalGrid`).** Library cover grid → Compose Foundation grid,
  themed mono.
- Anything we add must inherit `eInkColorScheme` (pure B/W, no ripple) so it visually
  matches MMD.

---

## Open questions (defer to CH.11 device pass)

Confirmable only on real Kompakt hardware:

1. **Volume-key interception** — can a sideloaded app consume
   `KEYCODE_VOLUME_UP/DOWN` (and the capacitive nav buttons) for page-turns, or does
   MuditaOS K swallow them? Decides whether hardware page-turn is offered at all.
2. **Exact `densityDpi` / `fontScale`** — read `DisplayMetrics.densityDpi`,
   `density`, and default `fontScale` on-device; vendors often set non-standard e-ink
   density. Confirms the hdpi-1.5× assumption and the real dp canvas size.
3. **System CJK fallback** — does `/system/fonts` on MuditaOS K include any
   Noto/Source-Han CJK? (We bundle JP regardless, but this tells us if KO/zh-Hant
   degrade.) Confirm no tofu with our bundled chain.
4. **E-ink refresh reality** — does any undocumented vendor refresh/full-flash
   `Intent`/SystemProperty/`EinkManager` exist? (Assumed none.) Measure real ghosting
   on paginated page-turns and tune A2-vs-full behaviour we can't directly trigger.
5. **Exact MuditaOS K / AOSP API level** — confirm Android 12 (API 31) vs other; our
   `targetSdk 35` runs fine on AOSP 12 but verify runtime behaviour (notifications,
   storage, splash) on the real OS.
6. **Touch panel quality** — e-ink digitizers can be laggy/imprecise; validate
   tap-zone hit areas and swipe-vs-tap disambiguation feel acceptable for reading.
7. **Refresh on `HorizontalPager`** — confirm full-page swap repaints cleanly
   (vs. tearing/partial) when we wire the real reader.

---

## Sources

- Mudita Kompakt Technical Specifications (official) — https://support.mudita.com/en/support/solutions/articles/77000577372-mudita-kompakt-technical-specifications
- Mudita Kompakt product page — https://mudita.com/products/phones/mudita-kompakt/
- Kompakt Quick Start — basic settings & customization — https://mudita.com/products/phones/mudita-kompakt/quick-start/basic-settings-and-customization/
- Notebookcheck — Mudita Kompakt E Ink Phone (AOSP-based) — https://www.notebookcheck.net/Mudita-Kompakt-E-Ink-Phone-A-minimalist-privacy-focused-phone-powered-by-Android.911587.0.html
- Techaeris hands-on review (touch + buttons + volume rocker) — https://techaeris.com/2025/05/30/mudita-kompakt-review/
- New Atlas — chipset (MediaTek MT6761 / Helio A22) & battery — https://newatlas.com/mobile-technology/compact-e-ink-phone-mudita-kompakt/
- Liliputing — Helio A22 confirmation — https://liliputing.com/mudita-kompakt-is-a-minimalist-phone-with-an-e-ink-display-and-modern-features-like-wireless-charging-and-a-fingerprint-reader-crowdfunding/
- MMD AAR (local) — `~/.gradle/caches/modules-2/files-2.1/com.mudita/MMD-android/1.0.0/.../mmd-core-release.aar`
- KompaktCalendar MMD reference app (local) — `/tmp/ref/KompaktCalendar`
