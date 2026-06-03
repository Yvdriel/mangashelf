# Plan: Offline Japanese Dictionary pillar for the Mudita Kompakt port

> Dictionary sub-plan of `docs/mudita-port-plan.md` (the gated Dictionary pillar). Designed
> 2026-06-02 in a dedicated brainstorming + deep-research session over jisho.org and the Renzo
> "Japanese" app. Gate cleared; decisions summarised in the port plan under "Pillar — Dictionary".

## Context

The Mudita Kompakt port (`docs/mudita-port-plan.md`) is a 3-pillar offline Japanese-study bundle: **Reader (+OCR)**, **Flashcards** (Anki rslib via rsdroid), and **Dictionary**. The Dictionary pillar was deliberately **GATED** — the user wanted its mechanics designed in a dedicated brainstorming session before any code. This is that session's output.

**Goal:** an offline Japanese dictionary that matches **jisho.org** and the **Renzo "Japanese" app** as closely as possible, running native on the Kompakt (Kotlin/Compose, SQLite, e-ink, 3 GB RAM, arm64, AOSP 12, frozen Chromium-128 WebView, airplane-mode only). Private personal use — licensing is out of scope.

**Key finding (from the research workflow):** the web app **already contains ~70% of the engine** in `src/lib/dict/**` — a Yomitan-style deinflector, condition bitmask, bank parser, and query/scan layer. These port to Kotlin near-verbatim (pure string ops + an `Int` bitmask, zero platform deps). The only genuinely new code is a **romaji→kana front-end**, a **forward conjugation generator**, the **SQLite storage swap**, and the **Compose UI**.

**Outcome:** in airplane mode the user reads a manga page, double-taps an OCR bubble → dictionary lookup popup (romaji/kana/kanji/conjugated all resolve) → optionally mines a flashcard; or opens the standalone Dictionary pillar to search (incl. by English meaning), browse kanji/kana/radical reference pages, and read example sentences + conjugation tables.

## Decisions locked (this session)

| Topic | Choice |
|---|---|
| Port strategy | **Port the TS engine to Kotlin + SQLite.** Not TS-in-WebView (no JS bridge, no IndexedDB-in-Chromium-128, synchronous SQLite like `better-sqlite3`). |
| Lookup model | **Rule deinflector only** (tap-driven app — OCR popup + search box supply the word boundary). Kuromoji tokenizer **deferred** behind the same `scan()` interface. |
| Data delivery | **Prebake the SQLite `.db` on desktop, ship it** (APK asset / first-run copy). Never parse ~36 MB Yomitan JSON on-device. Keep the existing on-device Yomitan-zip importer for optional add-ons. |
| Data scope | **Max everything (~400–700 MB)** — see §Data bundle. |
| English→JP search | **Yes.** FTS5 index over **English glosses only** (Latin text). FTS5 is never used on the Japanese word index. |
| Pitch accent | **Out of v1.** Opt-in dataset later (Kanjium/NHK Yomitan pitch bank, ~5–8 MB, zero schema change — the ported `parse-bank` already handles pitch banks). |
| Text Reader (paragraph gloss) | **Deferred.** No tokenizer in v1. |
| Glossary rendering | **Native Compose** recursive renderer (allowlist). HTML serialization kept **only** for the Anki card-back (F.8). |
| Deinflection coverage | **Port `ja-transforms.ts` as-is** (faithful Yomitan port). Same tables feed the forward `conjugate()` generator — one source of truth. |

These decisions are recorded in `docs/mudita-port-plan.md` under "Pillar — Dictionary — ✅ GATE CLEARED", replacing the prior ⛔ GATE placeholder.

## Total feature set

### Must-have (the user's stated needs — all achievable)

| Feature | Source | Mechanism |
|---|---|---|
| Romaji lookup (`taberu`→食べる) | algorithmic | `wanakana.toHiragana` (+katakana variant) at query time, gated by `isRomaji()`. **No romaji column** (romanization is lossy: shi/si, tsu/tu, ji/zi) — convert, don't index. |
| Conjugation lookup incl. romaji (`taberareru`→食べる + passive/potential) | rule engine over JMdict | **romaji→kana → deinflect BFS → exact-key lookup** (order is load-bearing). Emits readable reason chain; already dual-emits passive AND potential for ichidan られる — preserve. |
| Kana reference pages | authored asset + KanjiVG | hiragana/katakana charts (base/dakuten/handakuten/yōon) with romaji; per-char stroke order. |
| Kanji reference pages | KANJIDIC2 + KanjiVG + RADKFILE | browsable `kanji` table by grade/freq/radical; per-kanji detail. |
| Rich per-entry view | Jitendex + KANJIDIC2 + JmdictFurigana + Tatoeba | alt-kanji (rows sharing `sequence`), furigana, POS/verb-type (`rules`/`definitionTags`), kanji-in-word (`findKanji`, already built), examples, compounds, conjugation table. |
| Example sentences | Tanaka/Tatoeba (+ Jitendex-embedded) | `sentence` + `sentence_word(headword, reading)` join; B-line token index gives per-token furigana. |
| Common compounds (taberu→食べ過ぎる/食べ物) | JMdict self-join (no extra dataset) | word→compound = indexed `expression GLOB '食べ*'`; kanji→compound = precomputed `kanji_word` table; ranked by freq/score, capped at N. |
| Conjugation tables (formal/informal/other) | forward generator over POS | new `conjugate(dictForm, posMask)` — mirror of the deinflect tables run forward. **Round-trip test:** generate → re-deinflect → must return to dict form. |

### Recommended (Jisho/Renzo parity — in scope)

Radical kanji search (RADKFILE/KRADFILE, no-keyboard, ideal for e-ink) · kanji detail with KanjiVG stroke order · **English→JP gloss search** (FTS5 over English) · frequency/common ranking (multi-corpus freq banks; "common" badge from JMdict `*_pri` priority flags) · wildcard/prefix search (`食*`, suffix via reverse column) · `#tag` POS/misc filters · cross-links (Jitendex structured content → `sequence` links) · **name dictionary** (JMnedict — manga character/place names).

### Nice-to-have (later)

Kanji component "build-a-kanji" keyboard (KanjiVG `kvg:element`) · on/kun compound bucketing on kanji page (JmdictFurigana alignment; v1 ships a flat freq-ranked list) · search history/lists · Text Reader (Kuromoji-IPADIC paragraph gloss).

### Explicitly out

Flashcards/SRS (separate pillar) · kanji handwriting recognition · JLPT reference section (keep KANJIDIC2's JLPT field for sort only) · pronunciation/audio · **pitch-accent display** (opt-in dataset later, not v1).

## Data bundle (Max-everything) + SQLite storage

Bake on desktop with the **existing TS `parse-bank.ts` run under Node** (no need to port the parser for the bake — only the optional on-device importer needs the Kotlin port). Prefer Yomitan-format builds (the existing parser consumes their exact tuple shapes; `StructuredContent` type already in `types.ts`). Raw EDRDG files (KanjiVG, KRADFILE/RADKFILE, Tatoeba) parsed into custom tables.

| Dataset | Format | On-device | Powers |
|---|---|---|---|
| **Jitendex** | Yomitan term bank | ~120–180 MB | rich formatted entries, POS, alt forms, cross-refs, embedded examples |
| **JMnedict** | Yomitan term bank | ~60–90 MB | proper names (manga characters/places), distinct `dict` id, low priority |
| **KANJIDIC2** | Yomitan kanji bank | ~5–10 MB | kanji pages, "kanji used in this word" |
| **Freq banks** (JPDB + BCCWJ + Netflix + Innocent) | Yomitan `term_meta` freq | ~15–25 MB | result ordering + common badge + multi-corpus display |
| **KRADFILE + RADKFILE** | EUC-JP→UTF-8 at bake | 1–3 MB | radical search |
| **Tatoeba + jpn_indices** | A/B-line text | ~50–90 MB | exhaustive example sentences + per-token furigana |
| **JmdictFurigana** | JSON | small | headword furigana alignment + on/kun bucketing |
| **KanjiVG-all** | SVG on filesystem (NOT in SQLite) | ~10–20 MB | stroke order + component decomposition |
| **Kana tables** | authored asset | tiny | kana reference pages |

Romaji + conjugation need **no dataset** (algorithmic). Hard ceiling ~1 GB for the feature. Pitch (opt-in) and Kuromoji (deferred) are not bundled.

**SQLite schema** (direct translation of `db/idb.ts` object stores → tables; columns BINARY-collated so `GLOB 'prefix*'` stays index-eligible):

```sql
CREATE TABLE dictionaries(id TEXT PRIMARY KEY, title, revision, kind, priority INT, entryCount INT, installedAt INT);

CREATE TABLE terms(id INTEGER PRIMARY KEY, dict, expression, reading, expressionReverse,
  definitionTags, rules, score INT, glossary TEXT /*structured-content JSON*/, sequence INT, termTags);
CREATE INDEX idx_terms_expr ON terms(expression);        -- exact + GLOB prefix
CREATE INDEX idx_terms_read ON terms(reading);
CREATE INDEX idx_terms_exprrev ON terms(expressionReverse); -- suffix/ends-with
CREATE INDEX idx_terms_seq ON terms(sequence);           -- group alt forms / cross-ref target

CREATE TABLE kanji(id INTEGER PRIMARY KEY, dict, character, onyomi, kunyomi, tags, meanings, stats);
CREATE INDEX idx_kanji_char ON kanji(character);
CREATE TABLE frequency(id INTEGER PRIMARY KEY, dict, expression, reading, rank INT, displayValue);
CREATE INDEX idx_freq_expr ON frequency(expression);

-- NEW (no TS-engine equivalent):
CREATE TABLE kanji_radical(kanji, radical);  CREATE INDEX idx_kr_radical ON kanji_radical(radical);
CREATE TABLE kanji_word(kanji, term_id INT, reading_type, freq_rank INT); CREATE INDEX idx_kw_kanji ON kanji_word(kanji);
CREATE TABLE sentence(id INTEGER PRIMARY KEY, jp, en);
CREATE TABLE sentence_word(sentence_id INT, headword, reading, sense INT, surface, is_good_example INT);
CREATE INDEX idx_sw_head ON sentence_word(headword, reading);

-- English→JP search only (Latin free-text; FTS5 NEVER over Japanese):
CREATE VIRTUAL TABLE gloss_fts USING fts5(term_id UNINDEXED, gloss_en);
```

KanjiVG SVGs live on the **filesystem** keyed by zero-padded hex codepoint (not SQLite blobs) — keeps the DB small and lets WebView load them directly.

## Lookup architecture

Hot path is **exact-key equality on dictionary forms**, not full-text:

```
query → isRomaji()? → wanakana.toHiragana (+katakana)   [skip if already kana/kanji]
      → LanguageTransformer.transform(kana)              [ported ja-transforms BFS, MAX_DEPTH 8]
      → findTermsBulk(candidates)                        [exact-key B-tree on expression+reading]
      → keep rows where rulesToConditions(row.rules) ∩ candidate.conditions ≠ 0
      → longest-source-match, sort freq→score→dict-priority
      → attach kanji-in-surface, frequency, examples, compounds
```

- **Romaji→kana:** `dev.esnault.wanakana:wanakana-core` (MIT, pure-Kotlin WanaKana v4 port). Don't hand-roll the trie (n/sokuon/shi-si edge cases). Convert to hiragana **and** query the katakana form (cheap, for loanwords).
- **Deinflector:** port `conditions.ts` + `ja-transforms.ts` + `language-transformer.ts` verbatim. Already emits human-readable reasons and the dual passive/potential.
- **Wildcard:** left-anchored `GLOB 'prefix*'` on BINARY column (range scan, index-eligible). Suffix via `expressionReverse GLOB`. Arbitrary infix → `kanji_word` table or accept a rare full scan. Avoid `LIKE` (collation foot-gun).
- **English search:** `gloss_fts MATCH` → `term_id` → join `terms`. FTS5 only here + example-sentence free-text (with a CJK tokenizer if ever added to JP).
- **Forward `conjugate()`:** reuse the same `GODAN_*`/per-class suffix tables run forward, keyed on POS via `rulesToConditions` (`v1`/`v5*`/`vk`/`vs`/`adj-i`). Hardcode irregulars (する, 来る, いい→よ-). Groups: **formal** ます/ません/ました/ましょう · **informal** plain/ない/た/なかった · **other** て/たら/ば/volitional/potential/passive/causative/causative-passive/imperative.
- **Common compounds:** word→compound indexed prefix; kanji→compound precomputed `kanji_word` (built at bake, infix is unindexed over ~290k rows).

## Reuse map (`src/lib/dict/**` → Kotlin)

**Ports cleanly (LOW — pure logic):** `transforms/conditions.ts` (65) · `transforms/ja-transforms.ts` (182) · `transforms/language-transformer.ts` (67, the BFS) · `types.ts` (109 → data/sealed classes) · `db/queries.ts` (192 → SQL; `IDBKeyRange.only` → indexed `WHERE =`) · `db/idb.ts` (62 → `CREATE TABLE/INDEX`). `install/parse-bank.ts` (229) runs **as-is under Node at bake time**; port to Kotlin only for the optional importer.

**Ports with adaptation (MEDIUM):** `scanner.ts` (212 — `scanAt` longest-match + condition-mask filter; swap `findTermsBulk` to SQLite, keep the kanji/kana regexes, add the romaji front-end at the top) · `client.ts`/`protocol.ts`/`dict-worker.ts` (~520 — worker message-passing → coroutines + `Channel`; only needed for the importer) · `anki-card-dialog.tsx` `renderStructuredHTML` (reused for the F.8 card back; on-screen entries use the native Compose renderer).

**New code:** romaji front-end · forward `conjugate()` · `sentence`/`kanji_radical`/`kanji_word`/`gloss_fts` tables + bake steps · Compose UI · JmdictFurigana ingest.

**Kotlin lookup API (the contract for OCR popup O.3, standalone screen, and F.8):**

```kotlin
interface DictEngine {
  suspend fun lookup(query: String): ScanResult?                 // romaji→deinflect→exact-key
  suspend fun scan(text: String): List<ScanResult>              // token stream for OCR/selection
  suspend fun searchEnglish(query: String): List<TermHit>       // FTS5 gloss search
  suspend fun entry(sequence: Int): EntryDetail                 // alt forms, senses+POS, examples, compounds
  fun conjugate(dictForm: String, posMask: Int): ConjugationTable
  suspend fun kanji(ch: String): KanjiDetail                    // KANJIDIC2 + KanjiVG path + compounds
  suspend fun kanjiByRadicals(radicals: Set<String>): List<String>
  suspend fun compounds(stemOrKanji: String): List<TermHit>
  suspend fun examples(headword: String, reading: String?): List<Sentence>
  fun cardBackHtml(hit: TermHit, senseIndex: Int?): String      // reuses renderStructuredHTML for F.8
}
```

## Modules / screens

```
:feature-dictionary
  dict.engine   — LanguageTransformer, ja-transforms, conditions, conjugate()   (ported, pure, JVM-testable)
  dict.romaji   — wanakana wrapper (toHiragana/toKatakana/isRomaji)
  dict.data     — SQLite DAO/Room over the prebaked dict.db; scanner port; bulk queries; gloss FTS
  dict.import   — optional Yomitan-zip importer (parse-bank port + coroutine worker)  [enables pitch later]
  dict.render   — Compose StructuredContent renderer (allowlist) + HTML serializer for F.8
  dict.ui       — screens
build-tooling (desktop, not shipped): bake-db — runs parse-bank(TS) + KRADFILE/Tatoeba/KanjiVG/JmdictFurigana ingest → dict.db + SVG asset tree
```

**Screens:** (1) **Search** — unified box (romaji/kana/kanji/English/wildcard/#tag), debounced, ranked, inflection notice ("could be passive/potential of X"). (2) **Entry detail** — headword+furigana, romaji, alt forms, numbered senses w/ POS chips, kanji-in-word strip, examples, compounds, expandable conjugation table, "Add card"→F.8. (3) **Kanji detail** — glyph, meanings, on/kun/nanori, stats, KanjiVG stroke order, compounds, "kanji containing this". (4) **Kana table**. (5) **Radical search** — radical grid by stroke count, multi-select AND, grey-out impossible radicals.

## Build order (dictionary sessions — fit existing plan's phase naming)

**Phase D0 — Desktop data bake (no device):**
- **D0.1** `bake-db` tool: run existing `parse-bank.ts` under Node over Jitendex + JMnedict + KANJIDIC2 + freq banks → SQLite `terms`/`kanji`/`frequency`. (M)
- **D0.2** Custom ingests: KRADFILE/RADKFILE→`kanji_radical`, Tatoeba/jpn_indices→`sentence`/`sentence_word`, JmdictFurigana side table, build `kanji_word`, build `gloss_fts`, KanjiVG-all→SVG asset tree. (M)
- Acceptance: `dict.db` opens; spot-check 食べる lookup, 食べ-prefix compounds, radical→kanji, an example sentence with furigana, English "eat"→食べる via FTS.

**Phase D1 — Engine port (Kotlin, JVM/Robolectric, no device):**
- **D1.1** Port `conditions` + `ja-transforms` + `language-transformer` → `dict.engine`; JVM tests on known chains (食べさせられた→食べる, 飲みたかった→飲む, 読まなかった→読む). (M)
- **D1.2** `dict.romaji` wanakana wrapper + `isRomaji` gating; tests (taberu→たべる, ji/zu/n/sokuon edge cases). (S)
- **D1.3** `dict.data`: ship prebaked `dict.db` (Room `createFromAsset`), DAO + `queries.ts`/`scanner.ts` port → `lookup()`/`scan()`, exact-key + GLOB. (L)
- **D1.4** Forward `conjugate()` + round-trip test (generate→re-deinflect→dict form). (M)
- **D1.5** English FTS search + wildcard/#tag parser. (S)
- **D1.6** `entry()`/`kanji()`/`kanjiByRadicals()`/`compounds()`/`examples()`. (M)
- Acceptance: full `DictEngine` contract green against the baked db in JVM tests; romaji-conjugation path returns 食べる + reason chain.

**Phase D2 — Compose UI (emulator):**
- **D2.1** StructuredContent Compose renderer (allowlist `br ruby rt rp ul ol li div span table … details summary`; ruby→annotated spans). (M)
- **D2.2** Search screen. **D2.3** Entry detail. **D2.4** Kanji detail (+ KanjiVG SVG in WebView-128 or pre-rendered). **D2.5** Kana table. **D2.6** Radical search. (M each)

**Phase D3 — Integration:**
- **D3.1** Wire OCR popup **O.3** lookup pane → `scan()`/`lookup()`/`entry()` — removes the placeholder. (S)
- **D3.2** Dictionary entry → **F.8** `addMiningNote` via `cardBackHtml(hit, senseIndex)`. (S)
- **D3.3** Slot the Dictionary pillar into the 3-section app shell. (S)
- **D3.4** Optional Yomitan-zip importer (Kotlin `parse-bank` port) — unlocks the deferred **pitch** opt-in + extra dicts. (M, low priority)

**Phase D4 — Device polish (real Kompakt):** e-ink rendering of entries/kanji pages, CJK-font (Noto Sans JP) verify, stroke-order SVG redraw, ghosting on long entries (page-flip over scroll, grayscale).

## Verification

| Area | Without device | With device |
|---|---|---|
| D0 bake | spot-check queries on `dict.db` via `sqlite3`; assert counts vs source | never |
| D1 engine | JVM/Robolectric: deinflect chains, romaji edge cases, **conjugate round-trip**, full `DictEngine` contract on baked db | never |
| D2 UI | emulator API 28; render rich entry, kanji page, radical grid, kana table | recommended (tap feel) |
| D3 integration | emulator: OCR double-tap → popup lookup → add card; entry→F.8 round-trips into the local collection | recommended |
| D4 e-ink | — | **required** — ghosting, CJK font, stroke-order SVG, page-flip |

**End-to-end manual:** airplane mode → read pinned JP volume → double-tap bubble → lookup (try a conjugated form + a romaji query) → open entry → view conjugation table + examples + compounds → "Add card" → study in Flashcards pillar.

## Risks / open items

1. **wanakana-core availability/parity** — confirm the Maven artifact resolves and matches WanaKana v4 behavior; fallback is porting the trie. Verify in D1.2.
2. **Jitendex structured-content coverage in the Compose renderer** — some SC node types may be unhandled; allowlist-render and log unknowns. D2.1.
3. **`kanji_word` build cost/size** — infix over ~290k headwords; precompute at bake, cap per-kanji. D0.2.
4. **Tatoeba index quality** — jpn_indices B-line linkage is imperfect; keep `is_good_example` flag, prefer Jitendex-embedded where present. D0.2.
5. **DB size vs first-run copy time** — Max-everything `dict.db` may be large; measure `createFromAsset` copy on device, consider shipping compressed. D1.3 / D4.
6. **Stroke-order SVG on frozen Chromium-128 e-ink** — animation likely too heavy; default to static numbered strokes. D2.4 / D4.
7. **conjugate() POS gaps** — conditional ば lightly tested upstream; the round-trip test surfaces gaps cheaply. D1.4.

## Critical files to inspect at execution

- `src/lib/dict/transforms/{conditions,ja-transforms,language-transformer}.ts` — port targets (deinflector + forward generator source of truth)
- `src/lib/dict/types.ts` — `StructuredContent`/`GlossaryNode` + term/kanji/freq shapes
- `src/lib/dict/install/parse-bank.ts` — Yomitan bank parser (runs at bake; port for importer)
- `src/lib/dict/db/{idb,queries}.ts` — object stores/indexes + lookup queries → SQLite schema/DAO
- `src/lib/dict/scanner.ts` — `scanAt` longest-match + condition filter (add romaji front-end)
- `src/lib/dict/{client,protocol,dict-worker}.ts` — worker protocol (importer only)
- `src/components/ocr-overlay.tsx` — O.3 lookup-pane consumer
- `src/components/anki-card-dialog.tsx` — `renderStructuredHTML` + `buildCardBack()` (F.8 card back)
