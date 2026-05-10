import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnkiConnectError,
  ankiInvoke,
  addNote,
  findLastNoteInDeck,
  getVersion,
  storeMediaFile,
} from "./client";

const URL_LOCAL = "http://127.0.0.1:8765";
const URL_REMOTE = "http://anki.example.com:8765";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("ankiInvoke", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the result on success", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ result: 6, error: null }),
    );
    const v = await ankiInvoke<number>(URL_LOCAL, "version");
    expect(v).toBe(6);
  });

  it("sends action, version, params in the POST body", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(jsonResponse({ result: 1, error: null }));
    await ankiInvoke(URL_LOCAL, "addNote", { foo: "bar" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      action: "addNote",
      version: 6,
      params: { foo: "bar" },
    });
  });

  it("classifies fetch rejection on loopback as cors", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );
    await expect(ankiInvoke(URL_LOCAL, "version")).rejects.toMatchObject({
      kind: "cors",
    });
  });

  it("classifies fetch rejection on remote host as offline", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );
    await expect(ankiInvoke(URL_REMOTE, "version")).rejects.toMatchObject({
      kind: "offline",
    });
  });

  it("classifies upstream error string as rejected with the message", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ result: null, error: "deck was not found" }),
    );
    await expect(
      ankiInvoke(URL_LOCAL, "addNote"),
    ).rejects.toMatchObject({
      kind: "rejected",
      message: "deck was not found",
    });
  });

  it("classifies HTTP 500 as unknown", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({}, { status: 500 }),
    );
    await expect(ankiInvoke(URL_LOCAL, "version")).rejects.toMatchObject({
      kind: "unknown",
    });
  });

  it("classifies non-JSON success response as unknown", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("<html>", { status: 200 }),
    );
    await expect(ankiInvoke(URL_LOCAL, "version")).rejects.toMatchObject({
      kind: "unknown",
    });
  });

  it("AnkiConnectError carries the kind on its instance", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new TypeError("boom"),
    );
    try {
      await ankiInvoke(URL_LOCAL, "version");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AnkiConnectError);
      expect((err as AnkiConnectError).kind).toBe("cors");
    }
  });
});

describe("convenience helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getVersion calls action=version", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(jsonResponse({ result: 6, error: null }));
    await getVersion(URL_LOCAL);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.action).toBe("version");
  });

  it("storeMediaFile passes filename and data", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ result: "panel.jpg", error: null }),
    );
    const stored = await storeMediaFile(URL_LOCAL, "panel.jpg", "BASE64");
    expect(stored).toBe("panel.jpg");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.params).toEqual({ filename: "panel.jpg", data: "BASE64" });
  });

  it("addNote wraps fields and tags in the expected envelope", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(jsonResponse({ result: 12345, error: null }));
    const id = await addNote(URL_LOCAL, {
      deck: "Mining",
      model: "Basic",
      fields: { Sentence: "綾瀬", Image: "<img>" },
      tags: ["mangashelf"],
    });
    expect(id).toBe(12345);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.params.note.deckName).toBe("Mining");
    expect(body.params.note.modelName).toBe("Basic");
    expect(body.params.note.fields).toEqual({
      Sentence: "綾瀬",
      Image: "<img>",
    });
    expect(body.params.note.tags).toEqual(["mangashelf"]);
  });

  it("findLastNoteInDeck returns the max id when results exist", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ result: [3, 9, 5], error: null }),
    );
    const id = await findLastNoteInDeck(URL_LOCAL, "Mining");
    expect(id).toBe(9);
  });

  it("findLastNoteInDeck returns null when no notes match", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(jsonResponse({ result: [], error: null }));
    const id = await findLastNoteInDeck(URL_LOCAL, "Mining");
    expect(id).toBeNull();
  });
});
