export interface AnkiSettings {
  enabled: boolean;
  url: string;
  deck: string;
  model: string;
  fields: {
    sentence: string;
    image: string;
    source: string;
    definition: string;
  };
  tags: string[];
  imageFormat: "png" | "jpeg";
  jpegQuality: number;
  cropPadding: number;
  mode: "create" | "update-last";
  showPreviewDialog: boolean;
}

export const ANKI_DEFAULTS: AnkiSettings = {
  enabled: false,
  url: "http://127.0.0.1:8765",
  deck: "Mining",
  model: "Basic",
  fields: {
    sentence: "Sentence",
    image: "Image",
    source: "Source",
    definition: "Definition",
  },
  tags: ["mangashelf"],
  imageFormat: "jpeg",
  jpegQuality: 85,
  cropPadding: 16,
  mode: "create",
  showPreviewDialog: true,
};

export function parseAnkiSettings(raw: string | null): AnkiSettings {
  if (!raw) return { ...ANKI_DEFAULTS };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...ANKI_DEFAULTS };
  }
  return mergeAnkiSettings(parsed);
}

export function mergeAnkiSettings(input: unknown): AnkiSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ...ANKI_DEFAULTS };
  }
  const o = input as Record<string, unknown>;
  const fieldsIn =
    o.fields && typeof o.fields === "object" && !Array.isArray(o.fields)
      ? (o.fields as Record<string, unknown>)
      : {};
  const tagsIn = Array.isArray(o.tags)
    ? (o.tags.filter((t) => typeof t === "string") as string[])
    : ANKI_DEFAULTS.tags;

  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : ANKI_DEFAULTS.enabled,
    url: typeof o.url === "string" && o.url ? o.url : ANKI_DEFAULTS.url,
    deck: typeof o.deck === "string" && o.deck ? o.deck : ANKI_DEFAULTS.deck,
    model:
      typeof o.model === "string" && o.model ? o.model : ANKI_DEFAULTS.model,
    fields: {
      sentence:
        typeof fieldsIn.sentence === "string" && fieldsIn.sentence
          ? fieldsIn.sentence
          : ANKI_DEFAULTS.fields.sentence,
      image:
        typeof fieldsIn.image === "string" && fieldsIn.image
          ? fieldsIn.image
          : ANKI_DEFAULTS.fields.image,
      source:
        typeof fieldsIn.source === "string"
          ? fieldsIn.source
          : ANKI_DEFAULTS.fields.source,
      definition:
        typeof fieldsIn.definition === "string"
          ? fieldsIn.definition
          : ANKI_DEFAULTS.fields.definition,
    },
    tags: tagsIn,
    imageFormat:
      o.imageFormat === "png" || o.imageFormat === "jpeg"
        ? o.imageFormat
        : ANKI_DEFAULTS.imageFormat,
    jpegQuality:
      typeof o.jpegQuality === "number" &&
      o.jpegQuality >= 1 &&
      o.jpegQuality <= 100
        ? Math.round(o.jpegQuality)
        : ANKI_DEFAULTS.jpegQuality,
    cropPadding:
      typeof o.cropPadding === "number" && o.cropPadding >= 0
        ? Math.round(o.cropPadding)
        : ANKI_DEFAULTS.cropPadding,
    mode:
      o.mode === "create" || o.mode === "update-last"
        ? o.mode
        : ANKI_DEFAULTS.mode,
    showPreviewDialog:
      typeof o.showPreviewDialog === "boolean"
        ? o.showPreviewDialog
        : ANKI_DEFAULTS.showPreviewDialog,
  };
}

export function serializeAnkiSettings(s: AnkiSettings): string {
  return JSON.stringify(s);
}
