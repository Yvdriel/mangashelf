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
- [ ] 2.2  M ◈    TokenStore + Retrofit + AuthInterceptor  → 2.3 3.1
- [ ] 2.3  M ◈    onboarding screen                        → (library)
- [ ] 3.1  M ◈    Room v1 + entities + LibraryRepository   → 3.2 3.3
- [ ] 3.2  S ◈    LibraryDeltaWorker + manual refresh      → 3.3
- [ ] 3.3  M ◈    LibraryScreen                            → 3.4
- [ ] 3.4  M ◈    MangaDetailScreen + pin toggle           → 4.2 5.1
- [ ] 6.3  S ⇉    CI wiring (path-filtered)                → (guards all later)

### CH.5 — FLASHCARDS BODY  ⛓  (pillar track, forks after CH.1)
▶ENTRY: F.1 proven viable (CH.1).
■EXIT:  collection+mining-note+DI · FSRS review (4 buttons+intervals) · undo · scheduler settings · heatmap · import/export full-history · F.8 card-creation API exposed (= hook for OCR+Dict).
‖ PARALLEL: CH.4, CH.6, CH.7.
RECIPE: ⛓ WF. F.2 first. F.3→F.4 serial. F.8 forks after F.2. F.5,F.6,F.7 = 3-wide leaf fan off F.3/F.1. WORKTREE MANDATORY vs CH.4/CH.6 (shared libs.versions.toml + DI + nav-host). TDD FSRS intervals (test-vector vs desktop Anki).
RISK:   FSRS interval parity.
ITEMS:
- [ ] F.2  M ◈    collection bootstrap + mining note + DI  → F.3 F.8
- [ ] F.3  L ◈    review screen (FSRS, 4 buttons)          → F.4 F.5 F.6
- [ ] F.4  S ⇉    undo                                     →
- [ ] F.5  M ⇉    scheduler settings                       →
- [ ] F.6  M ⇉    calendar heatmap (📵 e-ink tune→CH.11)   →
- [ ] F.7  M ⇉    import/export full history               →
- [ ] F.8  S ⇉    card-creation (mining) API               → O.3 D3.2

### CH.6 — DICT ENGINE SPINE + UI  ⛓→⇉  (pillar track, forks after CH.2; split 6a/6b if ctx tight)
▶ENTRY: dict.db baked + D1.1/D1.2/D1.4 (CH.2) done · 2.1 (CH.1) for Compose.
■EXIT:  dict.data (prebaked db + DAO + lookup()/scan()) · FTS+wildcard/#tag · full entry/kanji/kanjiByRadicals/compounds/examples contract · StructuredContent renderer + search/entry/kanji/kana/radical screens.
‖ PARALLEL: CH.4, CH.5, CH.7.
RECIPE: 6a ⛓ — D1.3 FIRST+ALONE (L, db-copy/DAO, unknown on-device load), D1.5→D1.6 serial, D2.1 renderer folds in (no engine dep). 6b ⇉ — D2.2..D2.6 = 5-wide screen fan off D1.6+D2.1. WORKTREE vs CH.4/CH.5. TDD D1.3 load + D1.6 contract.
RISK:   on-device db load (size) · SC renderer node coverage.
ITEMS:
- [?] D1.3 L ◈    prebaked dict.db + DAO + lookup()/scan() → D1.5 D1.6
- [ ] D1.5 S ◈    English FTS + wildcard/#tag parser        → D1.6
- [ ] D1.6 M ◈    entry/kanji/kanjiByRadicals/compounds/examples → D2.* D3.1
- [ ] D2.1 M ◈    StructuredContent Compose renderer        → D2.2 D2.3
- [ ] D2.2 M ⇉    search screen                            →
- [ ] D2.3 M ⇉    entry detail screen                      → D3.1 D3.2
- [ ] D2.4 M ⇉    kanji detail (KanjiVG SVG 📵-verdict→CH.11) →
- [ ] D2.5 M ⇉    kana table screen                        →
- [ ] D2.6 M ⇉    radical search screen                    →

### CH.7 — READER CORE + ZOOM  ◈  (critical spine)
▶ENTRY: 3.4 (CH.4) + 0.4 device-spec findings (CH.1).
■EXIT:  CBZ page source + LRU 3-bitmap + decodeRegion decode large REAL page < 3GB heap NO OOM · ReaderScreen tap-nav + local progress write · long-press 9-pos zoom · eink ghosting after page-turn OBSERVED+characterized (tuning→CH.11). ⚔ OOM+ghosting evidence required.
‖ PARALLEL: CH.5, CH.6.
RECIPE: ◈ SOLO serial 4.1→4.2→4.3 (longest sub-chain, isolate vs ctx exhaustion). 4.1 TDD'd by subagent vs fixture CBZs (adb push) while 4.2 stubbed. fed by FIXTURES → lands before sync exists.
RISK:   4.1 bitmap OOM · 4.2 tap-zone gated by 0.4 · 4.3 gesture-on-eink.
ITEMS:
- [ ] 4.1  M ◈    CBZ page source + LRU + decodeRegion     → 4.2 4.3
- [ ] 4.2  L ◈⚔  ReaderScreen tap-nav + progress write    → 4.3 5.3 O.2
- [ ] 4.3  M ◈    long-press 9-position zoom               → O.2

### CH.8 — OFFLINE SYNC  ⛓
▶ENTRY: 1.3,1.4 (CH.3) + 3.4 (CH.4) + 4.2 (CH.7) done.
■EXIT:  DownloadVolumeWorker pins CBZ→device · DownloadsScreen · SyncProgressWorker push · progress pull/merge reconciles LWW · settings+error-states+401-recovery · .mokuro downloads w/ volume (O.1 rides 5.1).
‖ PARALLEL: front of CH.9 (5.1 must precede O.1).
RECIPE: ⛓ WF. 2 sub-chains 5.1→5.2 ‖ 5.3→5.4 = 2 subagents. 6.2 parallel. O.1 rides 5.1. WORKTREE vs CH.9 (both touch worker/DI reg). TDD 5.4 pull/merge reconcile.
RISK:   sync reconcile correctness · download resume across network drop.
ITEMS:
- [ ] 5.1  L ◈    DownloadVolumeWorker (stream CBZ)        → 5.2 O.1
- [ ] 5.2  S ◈    DownloadsScreen                          →
- [ ] 5.3  M ◈    SyncProgressWorker (push)                → 5.4
- [ ] 5.4  S ◈    progress pull + merge (LWW)              →
- [ ] 6.2  M ⇉    settings + error states + 401 recovery   →
- [ ] O.1  S ⇉    download .mokuro with volume             → O.2

> ★ INTEGRATION BARRIER — needs 4.2/4.3 + 5.1 + O-S.1 + O.1 + F.8 + D1.6/D2.3 ALL done.

### CH.9 — OCR OVERLAY + CROSS-PILLAR WIRE + APP SHELL  ◈→⇉  (THE shippable seam)
▶ENTRY: 4.2/4.3(CH.7) + 5.1/O.1(CH.8) + O-S.1(CH.3) + F.8(CH.5) + D1.6/D2.3(CH.6) done.
■EXIT:  mokuro overlay renders → double-tap → lookup popup → dict entry pane (D3.1) → "create card" via F.8 (D3.2) → Dict slotted into 3-section shell (D3.3). FULL read→OCR→lookup→mine→study loop. ⚔ end-to-end demo.
‖ PARALLEL: CH.10 may overlap. else = the convergence, little parallel.
RECIPE: front serial O.2→O.3 (strict). tail ⇉ D3.1,D3.2 = 2 subagents (popup-wire / card-mine). D3.3 3-section shell = shared nav-host → SERIALIZE LAST or worktree-isolate (collides w/ all).
RISK:   lowest intrinsic unknown (assembly) — risk = upstream slip stalling convergence.
ITEMS:
- [ ] O.2   M ◈    mokuro model + native overlay            → O.3
- [ ] O.3   S ◈    lookup popup shell                       → D3.1
- [ ] D3.1  S ⇉    wire OCR popup lookup pane (scan/entry)  →
- [ ] D3.2  S ⇉    dict entry → F.8 addMiningNote (cardBackHtml) →
- [ ] D3.3  S ◈    3-section app shell (nav-host, LAST)     →

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
