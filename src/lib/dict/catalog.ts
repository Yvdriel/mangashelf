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

// URLs target the canonical "always-latest" GitHub release downloads. They
// require GitHub-issued certs and follow redirects; the install proxy fetches
// these server-side so the browser never hits the cross-origin host.
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
    url: "https://github.com/MarvNC/kanjidic2-yomitan/releases/latest/download/KANJIDIC2.zip",
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
    url: "https://github.com/Kuuuube/yomitan-dictionaries/releases/latest/download/jpdb_v2.2_freq.zip",
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
    url: "https://github.com/MarvNC/BCCWJ-yomitan/releases/latest/download/BCCWJ.zip",
    license: "research-use",
    homepage: "https://clrd.ninjal.ac.jp/bccwj/",
    priority: 3,
  },
  {
    id: "innocent-corpus",
    title: "Innocent Corpus",
    description:
      "Light-novel / fiction-derived frequency list (popular for reading).",
    kind: "frequency",
    url: "https://github.com/yomidevs/yomitan/releases/latest/download/innocent_corpus.zip",
    license: "MIT",
    homepage: "https://learnjapanese.moe/freq/",
    priority: 4,
  },
];

export function findCatalogEntry(id: string): CatalogEntry | null {
  return CATALOG.find((e) => e.id === id) ?? null;
}
