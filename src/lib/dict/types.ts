// Yomitan-compatible types. The wire shape mirrors the v3 dictionary banks
// closely so ingest can be tuple-strict and the lookup engine never has to
// re-normalize at query time.

export type DictionaryId = string;
export type DictionaryKind = "terms" | "kanji" | "frequency";

export interface InstalledDictionary {
  id: DictionaryId;
  title: string;
  revision: string;
  kind: DictionaryKind;
  priority: number;
  entryCount: number;
  installedAt: number;
}

// A glossary node is either a plain string or a Yomitan structured-content
// object. We keep it as `unknown`-shaped to avoid carrying their full content
// schema, but we render it via an explicit allowlist in the UI.
export type GlossaryNode =
  | string
  | { type: "text"; text: string }
  | { type: "image"; path: string; width?: number; height?: number; title?: string }
  | { type: "structured-content"; content: StructuredContent };

export type StructuredContent =
  | string
  | StructuredContent[]
  | {
      tag: string;
      content?: StructuredContent;
      data?: Record<string, string>;
      style?: Record<string, string | number>;
      lang?: string;
    };

export interface TermRecord {
  id?: number;
  dict: DictionaryId;
  expression: string;
  reading: string;
  expressionReverse: string;
  definitionTags: string[];
  rules: string[];
  score: number;
  glossary: GlossaryNode[];
  sequence: number;
  termTags: string[];
}

export interface TermMetaRecord {
  id?: number;
  dict: DictionaryId;
  expression: string;
  mode: string;
  data: unknown;
}

export interface KanjiRecord {
  id?: number;
  dict: DictionaryId;
  character: string;
  onyomi: string[];
  kunyomi: string[];
  tags: string[];
  meanings: string[];
  stats: Record<string, string>;
}

export interface KanjiMetaRecord {
  id?: number;
  dict: DictionaryId;
  character: string;
  mode: string;
  data: unknown;
}

export interface FrequencyRecord {
  id?: number;
  dict: DictionaryId;
  expression: string;
  reading: string | null;
  rank: number;
  displayValue: string | null;
}

export interface DeinflectedForm {
  term: string;
  reasons: string[];
  conditions: number;
}

export interface TermHit {
  record: TermRecord;
  source: string;
  reasons: string[];
  frequency: number | null;
  frequencyDisplay: string | null;
  dictTitle: string;
}

export interface ScanResult {
  position: number;
  surface: string;
  hits: TermHit[];
  kanji: KanjiRecord[];
}
