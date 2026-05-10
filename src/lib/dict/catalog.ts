import type { DictionaryId, DictionaryKind } from "./types";

export interface CatalogEntry {
  id: DictionaryId;
  title: string;
  description: string;
  kind: DictionaryKind;
  url: string;
  license: string;
  homepage: string;
  // Display order in the settings UI; also default `priority` when installed.
  priority: number;
}

// URLs target GitHub release downloads, fetched server-side by the install
// proxy so the browser avoids the cross-origin host. Most use the
// "always-latest" alias; entries that pin a specific tag do so because the
// upstream only publishes pre-releases and `/releases/latest/` skips those —
// don't "fix" them back to `/latest/` or installs will 404.
export const CATALOG: ReadonlyArray<CatalogEntry> = [
  {
    id: "jitendex",
    title: "Jitendex (JMdict)",
    description:
      "Most thorough English JMdict-derived dictionary. Daily upstream rebuilds.",
    kind: "terms",
    url: "https://github.com/stephenmk/stephenmk.github.io/releases/latest/download/jitendex-yomitan.zip",
    license: "CC BY-SA 4.0",
    homepage: "https://jitendex.org/",
    priority: 0,
  },
  {
    id: "kanjidic2",
    title: "KANJIDIC2",
    description:
      "Per-kanji readings, meanings, JLPT level, stroke count, frequency.",
    kind: "kanji",
    url: "https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/KANJIDIC_english.zip",
    license: "CC BY-SA 4.0",
    homepage:
      "https://www.edrdg.org/wiki/index.php/KANJIDIC_Project",
    priority: 1,
  },
  {
    id: "jpdb-v2",
    title: "JPDB Frequency",
    description:
      "Frequency rank from jpdb.io's modern reading-corpus pipeline.",
    kind: "frequency",
    // Pinned tag: upstream only ships a `yomitan-permalink` pre-release.
    url: "https://github.com/Kuuuube/yomitan-dictionaries/releases/download/yomitan-permalink/JPDB_v2.2_Frequency_Kana.zip",
    license: "—",
    homepage: "https://jpdb.io/",
    priority: 2,
  },
  {
    id: "bccwj",
    title: "BCCWJ Frequency",
    description:
      "Balanced Corpus of Contemporary Written Japanese rankings.",
    kind: "frequency",
    // Pinned tag: upstream only ships a `yomitan-permalink` pre-release.
    url: "https://github.com/Kuuuube/yomitan-dictionaries/releases/download/yomitan-permalink/BCCWJ_SUW_LUW_combined.zip",
    license: "research-use",
    homepage: "https://clrd.ninjal.ac.jp/bccwj/",
    priority: 3,
  },
];

export function findCatalogEntry(id: string): CatalogEntry | null {
  return CATALOG.find((e) => e.id === id) ?? null;
}
