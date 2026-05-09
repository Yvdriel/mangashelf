export type AnkiErrorKind = "cors" | "offline" | "rejected" | "unknown";

export class AnkiConnectError extends Error {
  readonly kind: AnkiErrorKind;
  constructor(kind: AnkiErrorKind, message: string) {
    super(message);
    this.name = "AnkiConnectError";
    this.kind = kind;
  }
}

interface AnkiEnvelope<T> {
  result: T | null;
  error: string | null;
}

export async function ankiInvoke<T>(
  url: string,
  action: string,
  params: object = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, version: 6, params }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Browsers cannot distinguish "host unreachable" from "CORS preflight blocked"
    // at the fetch layer — both surface as the same TypeError. AnkiConnect is
    // almost always on localhost, so we use the URL host as a heuristic: if it
    // looks like a loopback address the user is most likely hitting CORS.
    const isLoopback = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/i.test(
      url,
    );
    throw new AnkiConnectError(isLoopback ? "cors" : "offline", message);
  }
  if (!res.ok) {
    throw new AnkiConnectError("unknown", `HTTP ${res.status}`);
  }
  let data: AnkiEnvelope<T>;
  try {
    data = (await res.json()) as AnkiEnvelope<T>;
  } catch {
    throw new AnkiConnectError("unknown", "Non-JSON response");
  }
  if (data.error) {
    throw new AnkiConnectError("rejected", data.error);
  }
  return data.result as T;
}

export function getVersion(url: string): Promise<number> {
  return ankiInvoke<number>(url, "version");
}

export function storeMediaFile(
  url: string,
  filename: string,
  dataB64: string,
): Promise<string> {
  return ankiInvoke<string>(url, "storeMediaFile", {
    filename,
    data: dataB64,
  });
}

export interface AddNoteParams {
  deck: string;
  model: string;
  fields: Record<string, string>;
  tags: string[];
}

export function addNote(
  url: string,
  { deck, model, fields, tags }: AddNoteParams,
): Promise<number> {
  return ankiInvoke<number>(url, "addNote", {
    note: {
      deckName: deck,
      modelName: model,
      fields,
      tags,
      options: {
        allowDuplicate: true,
        duplicateScope: "deck",
      },
    },
  });
}

export function findNotes(url: string, query: string): Promise<number[]> {
  return ankiInvoke<number[]>(url, "findNotes", { query });
}

export function updateNoteFields(
  url: string,
  noteId: number,
  fields: Record<string, string>,
): Promise<null> {
  return ankiInvoke<null>(url, "updateNoteFields", {
    note: { id: noteId, fields },
  });
}

export async function findLastNoteInDeck(
  url: string,
  deck: string,
): Promise<number | null> {
  // AnkiConnect's findNotes accepts the same query syntax as the Anki Browse
  // window. `added:1` would limit to the last day; we sort client-side instead
  // so the user's notion of "last" matches whatever they just made.
  const ids = await findNotes(url, `deck:"${deck}"`);
  if (ids.length === 0) return null;
  return Math.max(...ids);
}
