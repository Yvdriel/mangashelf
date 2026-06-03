-- CH.2 dict.db schema — single source of truth for the desktop bake.
-- Mirrors src/lib/dict/db/idb.ts object stores → SQLite tables, plus the custom
-- tables the TS engine has no equivalent for. All text KEYS are COLLATE BINARY so
-- GLOB 'prefix*' stays index-eligible (LIKE is collation-unsafe — never use it).
-- D0.1 builds terms/kanji/frequency/gloss_fts; D0.2 builds the rest; merge adds kanji_word.

CREATE TABLE IF NOT EXISTS dictionaries(
  id TEXT PRIMARY KEY, title TEXT, revision TEXT, kind TEXT,
  priority INTEGER, entryCount INTEGER, installedAt INTEGER
);

-- D0.1 ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS terms(
  id INTEGER PRIMARY KEY,
  dict TEXT NOT NULL,
  expression TEXT NOT NULL COLLATE BINARY,
  reading TEXT NOT NULL COLLATE BINARY,
  expressionReverse TEXT NOT NULL COLLATE BINARY,
  definitionTags TEXT,          -- JSON string[]
  rules TEXT,                   -- JSON string[]  (v1/v5*/vk/vs/vz/adj-i/iru)
  score INTEGER,
  glossary TEXT NOT NULL,       -- JSON GlossaryNode[]
  sequence INTEGER,
  termTags TEXT                 -- JSON string[]
);

CREATE TABLE IF NOT EXISTS kanji(
  id INTEGER PRIMARY KEY,
  dict TEXT NOT NULL,
  character TEXT NOT NULL COLLATE BINARY,
  onyomi TEXT, kunyomi TEXT, tags TEXT,   -- JSON string[]
  meanings TEXT,                          -- JSON string[]
  stats TEXT                              -- JSON Record<string,string>
);

CREATE TABLE IF NOT EXISTS frequency(
  id INTEGER PRIMARY KEY,
  dict TEXT NOT NULL,
  expression TEXT NOT NULL COLLATE BINARY,
  reading TEXT,
  rank INTEGER,                 -- NULL when source value is non-finite
  displayValue TEXT
);

-- D0.2 ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kanji_radical(
  character TEXT NOT NULL COLLATE BINARY,
  radical   TEXT NOT NULL COLLATE BINARY
);

CREATE TABLE IF NOT EXISTS radical(           -- radical → stroke count (from RADKFILE)
  radical TEXT PRIMARY KEY COLLATE BINARY,
  strokes INTEGER
);

CREATE TABLE IF NOT EXISTS sentence(
  id INTEGER PRIMARY KEY, jp TEXT NOT NULL, en TEXT
);

CREATE TABLE IF NOT EXISTS sentence_word(
  sentence_id INTEGER NOT NULL,
  headword TEXT NOT NULL COLLATE BINARY,
  reading TEXT, sense TEXT, surface TEXT
);

CREATE TABLE IF NOT EXISTS furigana(
  expression TEXT NOT NULL COLLATE BINARY,
  reading    TEXT NOT NULL COLLATE BINARY,
  segments   TEXT NOT NULL                 -- JSON [{ruby, rt?}]
);

-- merge ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kanji_word(       -- kanji → term self-join, capped per kanji
  character TEXT NOT NULL COLLATE BINARY,
  term_id INTEGER NOT NULL,
  rank INTEGER
);

-- English→JP search ONLY (Latin free-text). FTS5 is NEVER applied to the Japanese
-- index. term_id is UNINDEXED (stored, not tokenized) → MATCH on gloss_en returns
-- the owning terms.id directly. Regular fts5 (per spec) so count()/scans are safe.
CREATE VIRTUAL TABLE IF NOT EXISTS gloss_fts USING fts5(
  term_id UNINDEXED, gloss_en
);
