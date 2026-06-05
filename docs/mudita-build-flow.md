# MUDITA BUILD FLOW — master chapter order

> Orchestration index. Item detail → docs/mudita-port-plan.md + docs/mudita-dictionary-plan.md.
> This file = WHAT-order + HOW-run. Source docs = WHAT-each-item + acceptance.
> Derived 2026-06-03 (DAG + 3 ordering lenses + synth). Caveman-ultra.

## LEGEND
SIZE   S≈1day · M≈2day · L≈4day
STATUS [ ] todo · [~] wip · [x] done · [!] blocked · [?] spike-unresolved
DEVICE 📵 = real Kompakt needed → pool to CH.11 (never block software on it)
EXEC   ◈ SOLO (1 session, serial) · ⛓ WF (1 workflow, internal fan) · ⇉ FAN (parallel subagents + git worktree)
GATE   ▶ENTRY · ■EXIT · ⚔ adversarial-review gates EXIT
DEP    X → Y  (X unblocks Y)

## HOW-RUN-CHAPTER (Claude Code + workflows)
1. open CH → read ▶ENTRY → confirm all dep items [x].
2. pick EXEC:
   ◈ SOLO → 1 CC session, items serial (overlapping files / strict chain).
   ⛓ WF   → 1 workflow, independent items → subagents, shared TDD + 1 review.
   ⇉ FAN  → N subagents, EACH own git worktree (mutate shared ROOT files: libs.versions.toml / DI / nav-host).
3. ⚔ items → adversarial review MUST pass before ■EXIT.
4. tick item → [x]. CH done when all items [x] + ■EXIT met.
5. 📵 item → DO NOT run now → defer CH.11.
ctx rule: chapter ≈ 3–8 ids, ≤1 L-anchor. can't state ■EXIT in one breath → CH too big → split.

## TRACK MAP
```
WAVE-1  CH.1 /android/  ‖  CH.2 tools/  ‖  CH.3 src/        3 disjoint dirs, NO cross-worktree
        0.3 2.1 0.4 F.1    D0.1 D0.2          0.1 0.2 1.1 1.2
                           D1.1 D1.2 D1.4     1.3 1.4 O-S.1
  ════════════════════ ★ WAVE-1 BARRIER (2.1+1.1+dict.db open the pillar tracks) ════════════
WAVE-2  CH.5 FLASHCARD ‖ CH.6 DICT-eng+UI ‖ CH.4 CLIENT-DATA → CH.7 READER → CH.8 SYNC
        (shared root files → WORKTREE ISO mandatory)              (critical spine)
  ════════════════════ ★ INTEGRATION BARRIER (Reader+OCR+F.8+D1.6/D2.3 converge) ═══════════
WAVE-4  CH.9 OCR + cross-pillar wire + 3-section shell      ‖ CH.10 (D3.4, opportunistic)
  ════════════════════ ★ DEVICE GATE ════════════════════════════════════════════════════════
WAVE-6  CH.11 DEVICE PASS 📵  (real Kompakt, serial, no fan)
```
3 tracks: SERVER(src/) · DICT bake→engine(tools/→dict/) · ANDROID skel→flashcards+reader(/android/).
slip in ANY WAVE-2 pillar → stalls CH.9 convergence cliff.

## CRITICAL PATH
0.3 → 2.1 → 2.2 → 3.1 → 3.2 → 3.3 → 3.4 → 4.1 → 4.2 → 4.3 → 5.1 → 5.3 → 5.4 → 6.2 → O.2 → O.3 → D3.1 → 6.1/D4

---

## CHAPTERS

### CH.1 — SPIKE TRIAD  ◈→⇉
▶ENTRY: clean repo · JDK + Android SDK installed.
■EXIT:  app builds+installs (emulator) · device-specs.md answers input-model + eink-refresh-API + px/DPI + CJK-font inventory · rsdroid AAR resolves → loads arm64 → opens collection → 1 round-trip OR proven-dead + fallback-SRS logged. ⚔ F.1 verdict defended.
‖ PARALLEL: CH.2, CH.3 (disjoint /android ‖ tools ‖ src).
RECIPE: 0.3→2.1 ◈ serial (substrate). then ⇉ 0.4 doc-spike + F.1 AAR-spike = 2 worktree subagents. TDD F.1 round-trip smoke.
RISK:   BURN rsdroid-viability (sinks ~17d Flashcards if dead) + Kompakt input/eink/CJK-font (cross-cuts all 4 pillars).
ITEMS:
- [x] 0.3  M ◈    scaffold /android/ Gradle proj           → 2.1 4.1 F.1
- [x] 2.1  M ◈    theme + nav + DI wiring                  → 2.2 F.2 D2.* 3-shell
- [x] 0.4  S ⇉    document Kompakt device specs            → 4.2 4.3 eink
- [x] F.1  L ⇉⚔  rsdroid backend integration (SPIKE)      → F.2 F.7
✅ CH.1 DONE 2026-06-03 (commit 3dfe462). ■EXIT met: app builds+installs on kompakt28 · device.md answers input(touch, no D-pad)/eink(no refresh API)/screen(800×480 ~216ppi)/CJK(bundle Noto Sans JP). F.1 = VIABLE, ⚔ defended (independent re-run): rsdroid 0.1.50-anki25.02 loads real arm64 librsdroid.so, opens Anki-25.02 collection, read+write proto round-trip + reopen-persist GREEN on kompakt28 (instrumented) AND host JVM. CARRY-FORWARD for CH.5: (1) kotlinOptions `-Xskip-metadata-version-check` REQUIRED (AAR Kotlin-metadata 2.1.0 vs our 1.9.22); (2) call `System.loadLibrary("rsdroid")` before any Backend use (prod AAR ships no auto-loader); (3) toolchain pinned to MMD-1.0.0-proven matrix (Kotlin 1.9.22 / AGP 8.3 / Compose 1.7.3 / compiler 1.5.10).

### CH.2 — DICT DESKTOP BAKE  ⛓
▶ENTRY: none · source banks present (Jitendex/KANJIDIC2/freq/KRADFILE/Tatoeba/KanjiVG/JmdictFurigana).
■EXIT:  reproducible dict.db · ON-DISK-SIZE + DEVICE-COPY-TIME MEASURED+logged → go/no-go max-vs-trim · D1.1/D1.2/D1.4 green+tested. ⚔ numbers are real measurements not estimates.
‖ PARALLEL: CH.1, CH.3.
RECIPE: ⛓ D0.1‖D0.2 = 2 subagents (separate ingests). D1.1→D1.2/D1.4 fold-in (no device, no db → session stays full). TDD D1.2 wanakana-parity + D1.4 round-trip. worktree light (all tools/).
RISK:   BURN bake-size/copy-time (maybe infeasible on 3GB eink) · wanakana-Maven parity.
ITEMS:
- [x] D0.1 M ⇉    bake-db tool (run parse-bank.ts/Node)    → D0.2 D1.3
- [x] D0.2 M ⇉    custom ingests KRADFILE/Tatoeba/kanji_word/gloss_fts/KanjiVG → D1.3
- [x] D1.1 M ◈    port conditions+ja-transforms+transformer → D1.2 D1.4 D3.4
- [x] D1.2 S ◈    wanakana wrapper + isRomaji (parity CONFIRMED) → D1.3
- [x] D1.4 M ◈    forward conjugate() + round-trip test      → D1.6
✅ CH.2 DONE 2026-06-03 (branch MUDITA-chapter-2-dict off mudita-port; worktree-iso vs concurrent CH.3/CH.5). ■EXIT met. BAKE: reproducible via tools/bake-db/ (download.sh → bake-d01‖bake-d02 → merge; raw banks + out/ gitignored in tools/dict-data/). Sources max-everything in Yomitan format: Jitendex 430822 terms · JMnedict 667563 names · KANJIDIC2 10384 kanji · freq JPDB+BCCWJ+Innocent+Aozora 1.79M (Netflix gated→Aozora sub) · KRADFILE 54321 kanji_radical · Tanaka examples 147835 sentence/1.16M sentence_word · JmdictFurigana 234024 · KanjiVG 6702 SVG (fs tree, NOT in DB).
  ⚔ MEASURED (real, adversarially re-verified by independent agent — exact-byte match, n=7 timing):
   • FULL max-everything dict.db = 1,134,067,712 B (1081.5 MB) + KanjiVG 41 MB = 1122 MB → **NO-GO** (breaches ~1 GB ceiling).
   • JMnedict-TRIM dict.db = 974,753,792 B (929.5 MB) + 41 MB = 971 MB → **GO** (fits ceiling, ~30 MB headroom).
   • copy-time proxy on kompakt28 (arm64 API28 emulator, host-SSD — NOT real hardware): on-device cp median trim 5.08s / full 5.58s; ×4 conservative device est ≈ 20–22s ≪ 60s first-run bar. Size, not copy-time, is the constraint.
   • VERDICT: ship TRIM as dict.db; JMnedict (proper names, least essential for manga) → optional Yomitan-importer add-on (D3.4).
  PORTS (pure-JVM, TDD, 29 tests 0-fail): :dict:engine — Cond+LanguageTransformer (9) + Conjugator round-trip (12); :dict:romaji — wanakana wrapper (8). wanakana dev.esnault.wanakana:wanakana-core:1.1.1 parity CONFIRMED (shi/si·tsu/tu·ji/zi·sokuon·n) → no trie fallback.
  CARRY-FORWARD CH.6 D1.3: dict.db (~930 MB trim) → Room createFromAsset (~20s est first-run copy); gloss_fts = regular fts5(term_id UNINDEXED, gloss_en), query MATCH→term_id→join terms (the Android platform-tools sqlite3 CLI lacks FTS5 — use the app/better-sqlite3); KanjiVG ships as fs asset tree out/kanjivg/<2hex>/<5hex>.svg (NOT in DB); engine modules pure kotlin-jvm 1.9.22 (no Android dep), included in settings.gradle.kts as :dict:engine/:dict:romaji.

### CH.3 — SERVER API SURFACE  ⛓→⇉
▶ENTRY: existing Drizzle schema.
■EXIT:  bearer-auth + token-UI + library/delta + cover-thumb + CBZ-stream + progress GET/batch + OCR-sidecar — each integration-tested vs seeded DB.
‖ PARALLEL: CH.1, CH.2 (separate src/ tree).
RECIPE: 0.1 ◈ FIRST+ALONE (freeze auth schema migration). worktree iso MANDATORY before fan. then ⇉ 1.1,1.3,1.4,O-S.1,0.2 = 5 subagents (separate route files). 1.2 serial after 1.1 (same library-router). TDD per endpoint.
RISK:   standard (all known) — demoted, but gates client.
ITEMS:
- [x] 0.1   S ◈    API token schema + bearer auth helper    → 0.2 1.1 1.3 1.4 O-S.1
- [x] 0.2   M ⇉    token mgmt UI + endpoints                → 2.3
- [x] 1.1   M ⇉    library + delta endpoint                 → 1.2 2.2
- [x] 1.2   S ◈    cover thumbnail endpoint                 → 3.3
- [x] 1.3   L ⇉    CBZ archive streaming endpoint           → 5.1
- [x] 1.4   M ⇉    progress GET + batch POST                → 5.3
- [x] O-S.1 S ⇉    OCR sidecar /v1/.../ocr                  → O.1
✅ CH.3 DONE 2026-06-03 (branch MUDITA-chapter-3). ■EXIT met: bearer-auth (api_token + getSessionFromRequest, migration 0009) + token-UI (/settings/tokens) + /v1 library/delta + cover-thumb (ETag/304) + CBZ-stream (fflate zipSync STORE) + progress GET/batch (LWW by clientUpdatedAt) + OCR-sidecar (mtime ETag/304). 90 tests green vs seeded DB (per-file temp SQLite+MANGA_DIR harness, src/test/*); tsc + prod build clean. DEVIATION: fan-out ran shared-tree parallel (files verified disjoint) not worktree-iso. CARRY-FORWARD: (1) library delta is manga-level (volume table has no updatedAt); (2) better-sqlite3 needs `npm rebuild` for local Node ≠ 22; (3) repo lint already red pre-CH.3 (7 set-state-in-effect violations) — defer to CI wiring 6.3.

> ★ WAVE-1 BARRIER — CH.1+2+3 concurrent (3 disjoint dirs, no cross-worktree). after: 3 pillar tracks open.

### CH.4 — CLIENT DATA PLANE  ◈ (+ CI)
▶ENTRY: 2.1 (CH.1) + 1.1,1.2,0.2 (CH.3) done.
■EXIT:  onboard w/ bearer → Room v1 persists library → LibraryDeltaWorker syncs → LibraryScreen w/ covers → MangaDetailScreen + pin. 3.4 pin = hinge (reader+downloads). CI green on PR.
‖ PARALLEL: CH.5, CH.6, (CH.7 after 3.4).
RECIPE: ◈ SOLO spine 2.2→3.1→3.2→3.3→3.4. small fan 2.3 onboarding ‖ 3.1 Room after 2.2. 6.3 CI folded here (path-filter android/‖src/) → guards 7 later chapters.
RISK:   standard plumbing (after all spikes).
ITEMS:
- [x] 2.2  M ◈    TokenStore + Retrofit + AuthInterceptor  → 2.3 3.1
- [x] 2.3  M ◈    onboarding screen                        → (library)
- [x] 3.1  M ◈    Room v1 + entities + LibraryRepository   → 3.2 3.3
- [x] 3.2  S ◈    LibraryDeltaWorker + manual refresh      → 3.3
- [x] 3.3  M ◈    LibraryScreen                            → 3.4
- [x] 3.4  M ◈    MangaDetailScreen + pin toggle           → 4.2 5.1
- [x] 6.3  S ⇉    CI wiring (path-filtered)                → (guards all later)
✅ CH.4 DONE 2026-06-04 (branch MUDITA-chapter-4-client off mudita-port). ■EXIT met, verified live on kompakt28 against a seeded dev server: onboard w/ bearer (whoami validate → EncryptedSharedPreferences persist → route to Library, skipped on restart) → Room v1 persists library ((mangaId,volumeNumber) natural key) → LibraryDeltaWorker (6h periodic + one-shot, changedSince delta) → LibraryScreen w/ Coil covers → MangaDetailScreen + pin (persists across restart). Tests: JVM (AuthInterceptor header+base-URL-from-store, AuthValidator 200/401, LibraryMapper) + instrumented kompakt28 (LibraryDao flow + pin-survives-resync, DeltaWorker full-pull→no-op delta, MangaDetailScreen render+pin). assembleDebug + testDebugUnitTest green. SERVER FIX (in scope, approved): src/proxy.ts now exempts /api/v1 — it was redirecting bearer-only (cookieless) clients to /login before the route's getSessionFromRequest ran, blocking ALL native API. CARRY-FORWARD: (1) one authed OkHttpClient + host-rewrite AuthInterceptor (placeholder baseUrl) serves BOTH Retrofit and Coil — covers get the bearer for free, no custom Fetcher; (2) VolumeEntity.pinned is the hinge — applyDelta insert-ignores then updates server fields only, never clobbering pinned; CH.5 extends the detail status pill with download status; (3) instrumented Room/worker/Compose tests are local-only (kompakt28); CI = assembleDebug + testDebugUnitTest (JVM) — path-filtered android/** ‖ docs/** skip the web Docker build; (4) android:usesCleartextTraffic=true (self-hosted HTTP, emulator→10.0.2.2) + WorkManager default initializer removed in manifest for Hilt Configuration.Provider; (5) NO early `return` in a @Composable — it imbalances Compose's group stack (crash); guard = MangaDetailScreenTest.

### CH.5 — FLASHCARDS BODY  ⛓  (pillar track, forks after CH.1)
▶ENTRY: F.1 proven viable (CH.1).
■EXIT:  collection+mining-note+DI · FSRS review (4 buttons+intervals) · undo · scheduler settings · heatmap · import/export full-history · F.8 card-creation API exposed (= hook for OCR+Dict).
‖ PARALLEL: CH.4, CH.6, CH.7.
RECIPE: ⛓ WF. F.2 first. F.3→F.4 serial. F.8 forks after F.2. F.5,F.6,F.7 = 3-wide leaf fan off F.3/F.1. WORKTREE MANDATORY vs CH.4/CH.6 (shared libs.versions.toml + DI + nav-host). TDD FSRS intervals (test-vector vs desktop Anki).
RISK:   FSRS interval parity.
ITEMS:
- [x] F.2  M ◈    collection bootstrap + mining note + DI  → F.3 F.8
- [x] F.3  L ◈    review screen (FSRS, 4 buttons)          → F.4 F.5 F.6
- [x] F.4  S ⇉    undo                                     →
- [x] F.5  M ⇉    scheduler settings                       →
- [x] F.6  M ⇉    calendar heatmap (📵 e-ink tune→CH.11)   →
- [x] F.7  M ⇉    import/export full history               →
- [x] F.8  S ⇉    card-creation (mining) API               → O.3 D3.2
✅ CH.5 DONE 2026-06-03 (worktree MUDITA-chapter-5-flashcards off mudita-port). ■EXIT met: collection+"MangaShelf Mining" notetype+DI · FSRS review (4 buttons labelled w/ backend intervals) · undo · scheduler settings · total-reviews heatmap · .colpkg/.apkg import-export w/ full revlog · F.8 addMiningNote exposed (OCR/dict hook). All on rsdroid 0.1.50-anki25.02, NO proto codegen (AAR-bundled anki.* protos + named Backend wrappers). 14 instrumented tests GREEN on kompakt28 + JVM unit. TDD anchors GREEN: F.3 FSRS interval vector (fresh-card Easy graduate ~16d = FSRS-5 w[3], not SM-2 4d) + F.7 colpkg round-trip (revlog intact). CARRY-FORWARD: (1) updateDeckConfigs trailing booleans in proto field order = newCardsIgnoreReviewLimit(7)/fsrs(8)/applyAllParentLimits(9)/fsrsReschedule(10) — fsrs is the 2nd bool; (2) set TMPDIR (Os.setenv) to app-private dir before any backend file op — rslib export/media default to non-writable /data/local/tmp; (3) exportCollectionPackage CLOSES the collection (snapshot) → reopen after; (4) Noto Sans JP bundled res/font (system font Latin-only). 📵 e-ink/CJK/furigana render parity for F.3/F.6 pooled to CH.11.

> ✅ RESOLVED 2026-06-04 (branch `fix/f3-srs-interval-bleed`) — **NOT A BUG. No interval bleed exists.** Classification: neither (a) display-only nor (b) revlog corruption. The observed effect is **FSRS per-card interval fuzz** on multi-day intervals — each card's graduate/review interval is independently fuzzed ±~15–20% off the FSRS-5 prediction, so two adjacent cards legitimately show different day counts (e.g. A "1d", B "5d"). This is correct, intended Anki behaviour, misread as cross-card inheritance during the 2026-06-03 demo.
> **Evidence (both layers green on kompakt28):** new instrumented guard `ReviewIntervalBleedTest` (3 methods, ≥5 distinct cards each) proves, per card and via the backend's own `describeNextStates`/`getSchedulingStates`: (1) fresh new cards — the labels the screen shows equal a fresh per-card describe of that *same* card (fuzz-immune: same card → same fuzz seed), and Good writes that card's own learning step; (2) Easy graduate — the written multi-day interval equals that card's own displayed prediction; (3) **review-state re-review** (the exact "Good Nd, 2nd exposure" scenario, via `setDueDate`→overdue) — each card's multi-day Good label and the day-interval written both equal that card's own prediction, never a neighbour's. Visual confirm: walked 3 cards on-device — Good stayed `<10m` on every fresh card (no advancement), Easy scattered `19d/15d/17d` (random fuzz, not a monotonic A→B→C progression a bleed would produce).
> **Why fuzz looked like a bleed:** the eye can't tell "different fuzz sample" from "inherited progression". The data layer was never in doubt once the written `ivl` was asserted against `describe_next_states` per card — they match exactly. No production code changed; `nextCard()`/`answer()` are card-type-agnostic and per-card correct. The test is a permanent regression guard: it will fail if anyone ever caches scheduling states across cards or mis-binds `answerCard`.

### CH.6 — DICT ENGINE SPINE + UI  ⛓→⇉  (pillar track, forks after CH.2; split 6a/6b if ctx tight)
▶ENTRY: dict.db baked + D1.1/D1.2/D1.4 (CH.2) done · 2.1 (CH.1) for Compose.
■EXIT:  dict.data (prebaked db + DAO + lookup()/scan()) · FTS+wildcard/#tag · full entry/kanji/kanjiByRadicals/compounds/examples contract · StructuredContent renderer + search/entry/kanji/kana/radical screens.
‖ PARALLEL: CH.4, CH.5, CH.7.
RECIPE: 6a ⛓ — D1.3 FIRST+ALONE (L, db-copy/DAO, unknown on-device load), D1.5→D1.6 serial, D2.1 renderer folds in (no engine dep). 6b ⇉ — D2.2..D2.6 = 5-wide screen fan off D1.6+D2.1. WORKTREE vs CH.4/CH.5. TDD D1.3 load + D1.6 contract.
RISK:   on-device db load (size) · SC renderer node coverage.
ITEMS:
- [x] D1.3 L ◈    prebaked dict.db + DAO + lookup()/scan() → D1.5 D1.6
- [x] D1.5 S ◈    English FTS + wildcard/#tag parser        → D1.6
- [x] D1.6 M ◈    entry/kanji/kanjiByRadicals/compounds/examples → D2.* D3.1
- [x] D2.1 M ◈    StructuredContent renderer (model+flatten+cardBackHtml + Compose StructuredContentText) → D2.2 D2.3
- [x] D2.2 M ⇉    search screen                            →
- [x] D2.3 M ⇉    entry detail screen                      → D3.1 D3.2
- [x] D2.4 M ⇉    kanji detail (KanjiVG SVG render 📵→CH.11; shows path + info) →
- [x] D2.5 M ⇉    kana table screen                        →
- [x] D2.6 M ⇉    radical search screen                    →
✅ CH.6 6b DONE 2026-06-04 (same branch). 5 dict Compose screens (search/entry/kanji/kana/radical)
  fanned to 5 subagents (disjoint dict/ui/<screen>/ leaves; main owns Routes/NavHost/DI/StructuredContentText).
  Each = Route + @HiltViewModel + stateless screen + Compose UI test. 9 dict UI instrumented tests GREEN
  on kompakt28-2 (stateless screens, no DB needed). :app→:dict:data wired; :dict:engine exposed `api`
  (ConjugationTable/rulesToConditions leak through the contract); added DictEngine.radicals(). KanjiVG
  stroke-order SVG render stays 📵 (kanji screen shows the asset path + info; render verdict→CH.11/D2.4).
  Dict routes navigable but only launched from the 3-section shell (D3.3/CH.9). CH.6 ■EXIT met.
✅ CH.6 6a DONE 2026-06-04 (branch MUDITA-chapter-6-dict off mudita-port; worktree-iso). 6a ■: :dict:data
  module — `DictEngine` contract (lookup/scan/searchEnglish/search/entry/kanji/kanjiByRadicals/
  compounds/examples/conjugate/cardBackHtml) over the prebaked dict-trim.db (929 MB), + D2.1 render
  model (flatten + cardBackHtml). 32 tests GREEN (13 instrumented on kompakt28-2 + 19 JVM unit);
  :app still builds. 6b (D2.2–D2.6 screens) = parallel-fan follow-up.
  ⚔ KEY DEVIATION (approved): NOT Room. Room 2.6.1 can't model the gloss_fts FTS5 vtable and rejects
  the hand-baked DB (user_version=0, no room_master_table). Used a raw DAO over **androidx.sqlite
  BundledSQLiteDriver** (`androidx.sqlite:sqlite-bundled:2.5.2`) — ships SQLite 3.49 w/ FTS5 compiled,
  standalone (no Room), Google-hosted. (requery `io.requery:sqlite-android` was the first pick but is
  jcenter-only / unresolvable on Central.)
  CARRY-FORWARD CH.6 6b + later: (1) **FTS5 confirmed working on-device** via the bundled driver on
  API-28 (framework SQLite lacks it; platform-tools sqlite3 CLI lacks it too — test via app only);
  (2) tests **adb push** dict-trim.db → /data/local/tmp/dict.db and open it directly (no SELinux block
  on the emulator; the 930 MB asset can't ride in the test APK); prod path = `assets/dict/dict.db` via
  DictDatabaseProvider first-run copy (+ `androidResources { noCompress += "db" }`); (3) **KanjiVG path
  = `kanjivg/<first-2-of-5hex>/<5-pad-hex>.svg`** (食 U+98DF → kanjivg/09/098df.svg), NOT the doc's
  earlier `<2hex>/<5hex>`; (4) English search ranks the FTS5 bm25 candidate pool **by frequency** (long
  glosses padded with example sentences rank poorly under bm25); (5) unified `search()` routes Latin
  input to romaji-lookup only when it converts to CLEAN kana, else English FTS (eat→食べる, taberu→食べる);
  (6) root build.gradle needs `android-library apply false`; MMD jfrog repo content-scoped to
  `com.mudita` (it returns HTML 404s that break POM parsing for other coords).

### CH.7 — READER CORE + ZOOM  ◈  (critical spine)
▶ENTRY: 3.4 (CH.4) + 0.4 device-spec findings (CH.1).
■EXIT:  CBZ page source + LRU 3-bitmap + decodeRegion decode large REAL page < 3GB heap NO OOM · ReaderScreen tap-nav + local progress write · long-press 9-pos zoom · eink ghosting after page-turn OBSERVED+characterized (tuning→CH.11). ⚔ OOM+ghosting evidence required.
‖ PARALLEL: CH.5, CH.6.
RECIPE: ◈ SOLO serial 4.1→4.2→4.3 (longest sub-chain, isolate vs ctx exhaustion). 4.1 TDD'd by subagent vs fixture CBZs (adb push) while 4.2 stubbed. fed by FIXTURES → lands before sync exists.
RISK:   4.1 bitmap OOM · 4.2 tap-zone gated by 0.4 · 4.3 gesture-on-eink.
ITEMS:
- [x] 4.1  M ◈    CBZ page source + LRU + decodeRegion     → 4.2 4.3
- [x] 4.2  L ◈⚔  ReaderScreen tap-nav + progress write    → 4.3 5.3 O.2
- [x] 4.3  M ◈    long-press 9-position zoom               → O.2

✅ CH.7 DONE 2026-06-04 (branch MUDITA-chapter-7-reader off mudita-port). ■EXIT met, serial 4.1→4.2→4.3, TDD red→green per item on kompakt28 (API 28). **4.1** pure-JVM page logic (PageOrder natural sort, CbzIndex image filter, SampleSize inSampleSize math, BitmapLru recycle-on-evict) + Android `data/reader/PageSource` over ZipFile (BitmapFactory + minSdk28-safe BitmapRegionDecoder.newInstance(byte[],_,_,false)). **4.2** stateless ReaderScreen (LEFT=prev/RIGHT=next/thin TOP-CENTER=toggle bar via ReaderGestures), debounced single-tap, long-press→zoom, double-tap = no-op OCR seam; Room **v1→v2** additive MIGRATION_1_2 adds `progress` (manga/volume + pins preserved — exact Room createSql, MigrationTestHelper-validated); ProgressRepository local-only writes (clientUpdatedAt set, syncedUpdatedAt null); ReaderViewModel resumes stored page + persists every turn; hardware volume keys via ReaderKeyBus→MainActivity.onKeyDown; parameterized route `reader/{mangaId}/{volumeNumber}`. **4.3** ZoomState FullView↔Zoom(0..8) + ZoomGrid 3×3 (~2.7× ≈3×, 15% overlap, edge-clamped) rendered via decodeRegion (one discrete redraw/move, no animation); swipe snaps to neighbour cell, back→FullView same page; page-turn + OCR seam inert while zoomed; one region bitmap alive (recycled on move/exit). Tests: **35 JVM** (PageOrder 5, SampleSize 5, BitmapLru 4, ReaderGestures 6, VolumeKeys 3, ZoomGrid 5, ZoomState 7) + **26 instrumented kompakt28** (PageSource 4 incl OOM, Migration 1, ProgressDao 3, ReaderScreen 5, ReaderViewModel 7, ReaderZoomScreen 5, GhostingObservation 1); full suite 59 instrumented + all JVM green; CH.4 LibraryDao version assertion updated 1→2 (migration consequence).
⚔ GATE — (1) **OOM-free**: app default heap = **48 MB** (`dalvik.vm.heapgrowthlimit`; largeHeap 384 MB). Full page ARGB = W·H·4; a 4096² page un-sampled = 64 MB → 3 in LRU = 192 MB ≫ 48 MB = guaranteed OOM. `SampleSize.forWidth(srcW,~480)` → 4096-wide decodes at /8 = 512px ≈ 1 MB; 3-bitmap LRU ≈ 3 MB peak; region decode sampled the same way (≤ ~5 MB) with exactly one region alive. Recycle points: LruCache eviction (entryRemoved→recycle), region recycled on every move + on zoom exit, PageSource.close() recycles all. PROVEN: PageSourceTest streams a real 16 MP PNG (LargePng, no full-bitmap alloc — authoring also can't exceed 48 MB), decodes it 30× through the 3-LRU with no OOM, asserts sampled-small + evicted bitmaps isRecycled + size()≤3. No tiling needed (region sampling caps the largest single alloc); tiling documented as the fallback if a future page+zoom ever exceeds budget. (2) **Ghosting characterization** (OBSERVATION, not a fix): captured before/after page-turn screenshots on kompakt28 (ReaderGhostingObservationTest) — PAGE 1→PAGE 2 is a clean discrete full repaint, no residual text, no cross-fade/animation frame. Emulator is **LCD → behaviorally correct but visually unverified for e-ink** (real ghosting needs hardware → CH.11). The reader is already e-ink-friendly: NavHost transitions None + no in-screen page animation (instant Image swap) + MMD theme kills ripple + one discrete redraw per zoom move. What **6.1/CH.11** still needs (deferred): a full-screen-refresh hint on page-turn (flash-invert / `GC16` waveform via a MuditaOS-specific API if exposed), explicit 0 ms `LinearEasing` on any state-driven content swap, and confirmation that no ripple/indication leaks in on real hardware — none fixable on the LCD emulator.
CARRY-FORWARD: **CH.8** — reader writes LOCAL progress now (`progress.clientUpdatedAt` set, `syncedUpdatedAt` null); 5.3 owns the server push + LWW reconcile reading those columns. 5.1 must stream downloads to `filesDir/archives/<mangaId>/v<volumeNumber>.cbz` — the exact path ReaderModule.providePageSourceFactory resolves (DownloadVolumeWorker fills it; CH.7 acceptance `adb push`es fixtures there). ⚠ KNOWN ISSUE (logged under CH.8): reader opens the CBZ eagerly → a missing/corrupt file crashes the app (PageSource ZipFile ctor uncaught on IO); 5.1 must ensure-exists-before-Read + give ReaderViewModel an error path (not crash). **CH.9** — `ReaderScreen.onOcrBlockDoubleTap` is the unwired double-tap seam for O.2 (debounced, fires only outside zoom); `PageSource.decodeRegion(pageIndex, Rect, targetWidth)` is reused by O.3 for the OCR image crop (box+padding → full-res sub-region from the local CBZ bitmap).

### CH.8 — OFFLINE SYNC  ⛓
▶ENTRY: 1.3,1.4 (CH.3) + 3.4 (CH.4) + 4.2 (CH.7) done.
■EXIT:  DownloadVolumeWorker pins CBZ→device · DownloadsScreen · SyncProgressWorker push · progress pull/merge reconciles LWW · settings+error-states+401-recovery · .mokuro downloads w/ volume (O.1 rides 5.1).
‖ PARALLEL: front of CH.9 (5.1 must precede O.1).
RECIPE: ⛓ WF. 2 sub-chains 5.1→5.2 ‖ 5.3→5.4 = 2 subagents. 6.2 parallel. O.1 rides 5.1. WORKTREE vs CH.9 (both touch worker/DI reg). TDD 5.4 pull/merge reconcile.
RISK:   sync reconcile correctness · download resume across network drop.
ITEMS:
- [x] 5.1  L ◈    DownloadVolumeWorker (stream CBZ)        → 5.2 O.1
- [x] 5.2  S ◈    DownloadsScreen                          →
- [x] 5.3  M ◈    SyncProgressWorker (push)                → 5.4
- [x] 5.4  S ◈    progress pull + merge (LWW)              →
- [x] 6.2  M ⇉    settings + error states + 401 recovery   →
- [x] O.1  S ⇉    download .mokuro with volume             → O.2

> ⚠ KNOWN ISSUE (found in CH.7, fix here): the reader opens the CBZ eagerly — `PageSource`'s `ZipFile` ctor throws (FileNotFound / ZipException) on the IO dispatcher with NO catch, so a MISSING or CORRUPT archive **crashes the app** (hit live when nav args defaulted to 0/0 → `archives/0/v0.cbz`). 5.1 must (a) guarantee the file exists + is a valid zip before MangaDetail offers "Read"/navigates to the reader, and (b) give the reader a failure path — `ReaderViewModel` should catch the open/decode failure and emit an error UiState, not crash. Surfaces whenever a download is absent, partial, or interrupted. ✅ FIXED in 5.1 (atomic temp→rename never leaves a half-file; `ReaderViewModel` catches open/decode → error UiState; `ReaderScreen` renders it via if/else, no early return).

✅ CH.8 DONE 2026-06-04 (branch MUDITA-chapter-8-sync off mudita-port; worktree-iso vs CH.9). ■EXIT met, serial TDD 5.1→O.1→5.2→5.3→5.4→6.2, red→green per item on kompakt28 (API 28). **5.1** `DownloadVolumeWorker` (HiltWorker) streams the `/v1 archive` via Retrofit `@Streaming` `Response<ResponseBody>` to a `.part` temp then **atomic rename** onto the EXACT reader path `filesDir/archives/<mangaId>/v<volumeNumber>.cbz` — extracted into a shared `ArchivePaths` helper now used by BOTH the worker and `ReaderModule` so they can't drift (⚠ path is **NOT zero-padded** — `v1.cbz`; the prompt's "zero-padding as CH.7 expects" was wrong, matched the actual CH.7 code); live % via `WorkInfo.progress`; `download_queue` Room table via additive **v2→v3** `MIGRATION_2_3` (+`DownloadEntity`/`DownloadDao`/`DownloadState` enum + TypeConverter; pins+progress preserved, MigrationTestHelper-validated); `DownloadRepository` enqueues unique CONNECTED work on pin / cancels+deletes files on unpin; `MangaDetailViewModel.togglePin` now actually triggers/cancels. **O.1** worker also GETs `/v1/.../ocr` → `v<n>.mokuro` beside the CBZ, **404 skipped silently** (volume still succeeds), unpin deletes both. **5.2** `DownloadsScreen` merges `download_queue` + live `WorkInfo` (per-volume tag) + titles; cancel/retry per row. **5.3** `SyncProgressWorker` (HiltWorker) batch-POSTs dirty progress to `/v1/progress/batch`, debounced 5s (`ProgressSyncScheduler`, unique+REPLACE) after each local write; pure `ProgressSync` maps client `(mangaId,volumeNumber)`→server `volumeId` + **millis→seconds**, marks accepted AND rejected synced (rejected = no retry). **5.4** progress pull folded into `LibraryDeltaWorker` (`GET /v1/progress?changedSince`), pure `ProgressMerge` LWW. **6.2** `AuthEventBus` + `AuthInterceptor` 401 hook (clears token, signals) → `MainActivity` boots to Onboarding **preserving `filesDir/archives`**; `SettingsScreen` server-change (confirm→purge) / Sync now / Clear cache. Tests: **18 JVM** (ArchivePaths 4, DownloadProgress 6, ProgressSync 3, ProgressMerge 4, + AuthInterceptor 401) + **25 instrumented kompakt28** (DownloadDao 3, MigrationV3 1, DownloadVolumeWorker 6, DownloadRepository 3, SyncProgressWorker 4, ProgressPullMerge 2, DownloadsScreen 2, SettingsScreen 2, ReaderViewModel +2 error); CH.8+touched instrumented batch = **40 green**; `assembleDebug` + `testDebugUnitTest` clean; APK installs + boots clean to Onboarding on kompakt28 (DI graph incl. new singletons OK).
⚔ GATE — (1) **resume across network drop**: `DownloadVolumeWorkerTest` feeds an okio body that emits 64 B then throws `IOException` mid-stream → worker returns `Result.retry()` and the final path is ABSENT (no half-file); a second run with the full archive → `Result.success()` + valid `ZipFile`. CONNECTED constraint + exponential backoff re-runs it on reconnect; restart-stream (the `/v1` zip is built in-memory, no Range). (2) **corrupt/missing-file guard**: `ReaderViewModelTest` opens an absent CBZ and a non-zip file → both emit an error UiState, bitmap stays null, **no crash**. (3) **LWW reconcile both directions** (`ProgressMergeTest` JVM + `ProgressPullMergeTest` kompakt28): server-newer (`updatedAt*1000 > clientUpdatedAt`) overwrites the device row; a device-local-newer (unpushed) row survives the pull untouched; equal timestamps keep local.
NOTE: live seeded-dev-server walkthrough (UI onboard → pin → download → reconnect-sync → revoke-token) is the recommended reviewer manual step — not run here (fresh worktree has no node_modules/seed; minting a bearer token needs a logged-in better-auth session). Every device-level behavior is proven by the on-device instrumented tests above against real zip fixtures + fakes.
CARRY-FORWARD CH.9: (1) O.1 puts the `.mokuro` beside the CBZ at `ArchivePaths.mokuro(filesDir, mangaId, volumeNumber)` = `filesDir/archives/<mangaId>/v<volumeNumber>.mokuro` (NOT zero-padded) — O.2's overlay reads it there; O.3's crop reuses the same path + `PageSource.decodeRegion`. (2) **worktree-isolate against** `sync/DownloadVolumeWorker.kt` + `sync/LibraryDeltaWorker.kt` (now also pulls progress) + their HiltWorker/`HiltWorkerFactory` registration + `WorkModule` (now provides `ProgressSyncScheduler`) + `DownloadRepository` + the nav-host (`SETTINGS`/`DOWNLOADS` are Route wrappers now) — CH.9 touches the same DI/nav/sync surface. (3) Room is **v3** (download_queue); any CH.9 schema add = additive `MIGRATION_3_4` + exported `4.json`. (4) `AuthEventBus` 401→Onboarding is global (collected in `MainActivity`); the single authed OkHttpClient is unchanged. (5) `ProgressMerge`/`ProgressSync`/`ArchivePaths`/`DownloadProgress` are pure JVM (no device needed to test).

> ★ INTEGRATION BARRIER — needs 4.2/4.3 + 5.1 + O-S.1 + O.1 + F.8 + D1.6/D2.3 ALL done.

### CH.9 — OCR OVERLAY + CROSS-PILLAR WIRE + APP SHELL  ◈→⇉  (THE shippable seam)
▶ENTRY: 4.2/4.3(CH.7) + 5.1/O.1(CH.8) + O-S.1(CH.3) + F.8(CH.5) + D1.6/D2.3(CH.6) done.
■EXIT:  mokuro overlay renders → double-tap → lookup popup → dict entry pane (D3.1) → "create card" via F.8 (D3.2) → Dict slotted into 3-section shell (D3.3). FULL read→OCR→lookup→mine→study loop. ⚔ end-to-end demo.
‖ PARALLEL: CH.10 may overlap. else = the convergence, little parallel.
RECIPE: front serial O.2→O.3 (strict). tail ⇉ D3.1,D3.2 = 2 subagents (popup-wire / card-mine). D3.3 3-section shell = shared nav-host → SERIALIZE LAST or worktree-isolate (collides w/ all).
RISK:   lowest intrinsic unknown (assembly) — risk = upstream slip stalling convergence.
ITEMS:
- [x] O.2   M ◈    mokuro model + native overlay            → O.3
- [x] O.3   S ◈    lookup popup shell                       → D3.1
- [x] D3.1  S ⇉    wire OCR popup lookup pane (scan/entry)  →
- [x] D3.2  S ⇉    dict entry → F.8 addMiningNote (cardBackHtml) →
- [x] D3.3  S ◈    3-section app shell (nav-host, LAST)     →
NOTE (from CH.5 emulator demo 2026-06-03): F.3 review renderer maps the **Mining notetype** field order (Sentence/Image/Definition/Source) — non-Mining notes render the back BLANK below the divider. So D3.2 mining MUST addNote into the Mining notetype (cardBackHtml → Definition field), else mined cards review with an empty back. Verify in the CH.9 end-to-end demo. (FSRS/scheduling/import were unaffected — front + 4-button intervals + answer-advance all green.)

✅ CH.9 DONE 2026-06-04 (branch MUDITA-chapter-9-seam off mudita-port; worktree-iso vs CH.8). ■EXIT met, serial TDD O.2→O.3→D3.1→D3.2→D3.3, red→green per item on kompakt28 (API 28). **O.2** new `ocr/` package: `MokuroModel` (kotlinx.serialization parse of the on-device `.mokuro`; NOT org.json — it's a JVM-test stub) + `MokuroDoc.pageFor` (CBZ-entry-basename match, positional fallback) + `OverlayScale` (pure ContentScale.Fit rect + block→screen + source-px crop math) + `OcrOverlay` (transparent per-block tappable layer, largest-first so the smallest wins hit-test; **double-tap only**, NO long-press alias — long-press stays zoom); `PageSource.entryName(i)`; `MokuroSourceFactory` (Hilt, reads `ArchivePaths.mokuro`); `ReaderUiState.ocrPage`/`overlayVisible` + `toggleOverlay`; overlay composed in FullPageLayer **FullView-only** (hidden while zoomed → double-tap inert + cuts e-ink ghosting); page-level `onDoubleTap = {}` kept purely for the double-tap debounce. **O.3** `OcrLookupSheet` = MMD `ModalBottomSheetMMD` (MMD ships a full component set — `nav_bar`/`bottom_sheet`/`tabs`/`cards`/etc., not just Button/Text) with selectable OCR text + native crop preview + "Create card"; block-select crops the page region natively via `PageSource.decodeRegion(box+pad, targetWidth)` → JPEG bytes (replaces web `/api/anki/capture`+sharp, no server). **D3.1** `ReaderViewModel` injects `DictEngine`; block-select runs `scan(sentence)` → results rendered in the sheet via the EXISTING `StructuredContentText` + deinflection reason chain (conjugated 食べた → 食べる shown "← past"). **D3.2** "Create card" → `OcrCardMiner` (Hilt seam over `CollectionRepository.miningDeckId()`+`addMiningNote`) with `definitionHtml = dictEngine.cardBackHtml(hit, senseIndex)` → **Mining notetype** (TMPDIR already set in `ensureOpen`, CH.5); ⚠ blank-back guard test added: a mined note's `nextCard().fields.definitionHtml` is NON-blank. **D3.3** native `NavigationBarMMD`/`NavigationBarItemMMD` 3-section shell (`AppShell` wraps the NavHost; pure `ShellNav` route→section + bar-visibility, JVM-tested) — **Reader** (LIBRARY) / **Dictionary** (DICT_SEARCH) / **Flashcards** (new `FLASHCARDS_HOME` hub); bar hidden on onboarding + reader (immersive); flashcards entries relocated out of the Library header into the home hub; `MainActivity` renders `AppShell`. Reader VM decoupled from flashcards/dict via narrow `OcrCardMiner`/`DictEngine` seams so it unit-tests without the Anki backend or dict.db. Tests: **19 JVM** (MokuroParser 5, MokuroDoc 4, OverlayScale 5, ShellNav 5) + **CH.9 instrumented on kompakt28** (OcrOverlay 3, ReaderScreenOcr 3, OcrLookupSheet 3, ShellBottomBar 3, ReaderViewModel +3 = 12, MiningNote +1 = 2, Ch9Loop 1) red→green; full `:app` `connectedDebugAndroidTest` = **101 green on kompakt28** (incl. a drive-by fix of a pre-existing CH.8 stale `LibraryDaoTest` DB-version assertion 2→3 — schema's been v3 since CH.8); `assembleDebug` + `testDebugUnitTest` clean; APK installs + boots clean (new DI graph: MokuroSourceFactory/OcrCardMiner/DictEngine into ReaderViewModel OK).
⚔ GATE — `Ch9LoopTest` (kompakt28, ONE offline run, REAL reader + Anki components) drives the whole loop: (1) open volume → page exposes its mokuro block to the overlay; (2) double-tap the 食べた bubble → popup resolves it to dict form 食べる (reason "past") + a native CBZ crop; (3) "Create card" → lands in the **Mining** deck (newCount==1); (4) `nextCard` → FRONT=食べた + **non-blank BACK** (definition contains 食べる). Step (5) 3-section shell switch = `ShellBottomBar` test (renders Reader/Dictionary/Flashcards; tap routes to the right section) + JVM `ShellNav`. The conjugated→dict-form deinflection is independently proven by JVM `LanguageTransformerTest`/`ConjugatorTest` (食べさせられた/食べました/食べた → 食べる); the live 930 MB `dict.db` lookup + full server-synced UI walkthrough were NOT runnable in the fresh worktree (no baked dict.db artifact / no node_modules+token — same constraint as the CH.8 stamp) → the engine's real-DB resolution is covered by CH.6 `DictEngineContractTest` when the DB is pushed, and the OCR popup faked DictEngine only for `scan`/`cardBackHtml` (everything else real).
CARRY-FORWARD CH.11: (1) 📵 **overlay alignment on real e-ink** — `OverlayScale` block rects are JVM-correct but visual bubble-fit + tap-feel need the Kompakt (LCD emulator can't confirm); (2) 📵 **CJK in the popup** — Noto Sans JP for OCR text + glossary + nav-bar glyphs (本/辞/札) needs device font verify; (3) 📵 overlay-render **ghosting** — overlay is hidden in zoom (one mitigation) but the FullView overlay redraw on page-turn needs a full-refresh/flash-invert verdict with reader 6.1; (4) 📵 **grayscale crop downsample** — mined card images are full-color JPEG now; e-ink wants a grayscale/contrast pass (folds into D4 + the F.3/F.6 card-render device pass); (5) live **dict.db** real-lookup demo + the seeded-server pin→download→overlay walkthrough remain the manual reviewer steps once the bake/seed are available.

### CH.10 — OPTIONAL  ⇉  (ungated, opportunistic)
▶ENTRY: D1.1/D0.2 (CH.2) for D3.4.
■EXIT:  optional Yomitan-zip importer (unlocks deferred pitch + extra dicts).
‖ PARALLEL: anytime after deps.
RECIPE: ⇉ 1 subagent. ships opportunistically. (6.3 CI already pulled to CH.4.)
ITEMS:
- [ ] D3.4  M ⇉    optional Yomitan-zip importer (parse-bank Kotlin port) →

> ★ DEVICE GATE — all 📵 pooled below. real Kompakt in hand. software chapters 1–10 green+merged first.

### CH.11 — DEVICE PASS  ◈ 📵  (terminal, serial, no fan)
▶ENTRY: CH.1–10 green+merged · real Kompakt in hand.
■EXIT:  eink ghosting/full-refresh tuned · Noto Sans JP CJK verified across reader+flashcards+dict · grayscale manga-crop downsample on cards · KanjiVG stroke render decided (static fallback default) · long-entry page-flip-vs-scroll settled · reader 4.2/4.3 tap-feel confirmed.
‖ PARALLEL: none.
RECIPE: ◈ SOLO, single physical device, adversarial-review + rework loop. discovery front-loaded (CH.1 specs, CH.7 ghosting) → this is TUNING not DISCOVERY.
ITEMS:
- [ ] 6.1     M 📵   e-ink display tuning (reader)          →
- [ ] D4      M 📵   dict e-ink + CJK font + ghosting + SVG verdict →
- [ ] 4.2/4.3 - 📵   reader tap-feel device-verify          →
- [ ] F.3/F.6 - 📵   flashcard card-render + heatmap e-ink  →
- [ ] D2.4    - 📵   KanjiVG stroke-order render verdict     →

---

## RECONCILE (which lens won where)
- risk-first → CH.1 (F.1+0.4 spikes), CH.2 (bake feasibility), CH.7 reader pulled forward via fixtures.
- dependency-strict → CH.3→4→7→8 spine, CH.9 single integration seam, CH.11 device pool.
- parallelism-max → Wave-1 triple-root (1‖2‖3), pillar fan-out (5‖6‖7), 5-wide dict screens, leaf fans.

## WORKTREE-ISO MANDATORY WHEN
- concurrent edits libs.versions.toml / DI graph / nav-host → CH.5 ‖ CH.6 ‖ CH.4 (Wave-2).
- fan-out AFTER shared schema/middleware freeze → CH.3 (post-0.1).
- worker + DI registration collide → CH.8 ‖ CH.9.
- 3-section shell D3.3 touches nav-host used by all → CH.9 serialize LAST or isolate.
- NOT needed when path-disjoint (Wave-1 /android ‖ tools ‖ src) → cheapest parallelism.

## ⚔ ADVERSARIAL-GATE EXITS
CH.1 F.1 viability (defend works/dead) + 0.4 spec completeness · CH.2 bake size/copy REAL numbers ·
CH.7 OOM-free + ghosting evidence (heap dump) + 4.2 tap-zone matches 0.4 · CH.9 full loop demo ·
CH.11 eink+CJK on real hardware. else = standard TDD per item, review per-PR.

## TDD FOCUS
F.1 round-trip smoke · D1.2 wanakana parity · D1.4 conjugate round-trip · D1.3 on-device db load ·
4.1 decode vs fixture CBZ · 5.4 pull/merge reconcile · each server endpoint vs seeded DB.
