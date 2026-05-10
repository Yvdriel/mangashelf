"use client";

import { useCallback } from "react";
import { useSettings } from "@/contexts/settings";
import {
  AnkiConnectError,
  addNote,
  findLastNoteInDeck,
  getVersion,
  storeMediaFile,
  updateNoteFields,
  type AnkiErrorKind,
} from "@/lib/anki/client";
import { expandTags } from "@/lib/anki/tag-template";
import { stripLinebreaks } from "@/lib/copy/strip-linebreaks";
import type { AnkiSettings } from "@/lib/settings/anki";

export interface SendCardArgs {
  mangaId: number;
  volumeNumber: number;
  mangaTitle: string;
  pageIdx: number;
  blockText: string;
  blockBox: [number, number, number, number];
  definition?: string;
}

export interface TestResult {
  ok: boolean;
  version?: number;
  kind?: AnkiErrorKind;
  message?: string;
}

export interface SendResult {
  noteId: number;
  mode: AnkiSettings["mode"];
  deck: string;
}

export class SendError extends Error {
  readonly kind: AnkiErrorKind | "config";
  constructor(kind: AnkiErrorKind | "config", message: string) {
    super(message);
    this.name = "SendError";
    this.kind = kind;
  }
}

export function useAnki() {
  const { settings } = useSettings();
  const anki = settings.anki;

  const testConnection = useCallback(async (): Promise<TestResult> => {
    try {
      const v = await getVersion(anki.url);
      return { ok: true, version: v };
    } catch (err) {
      const e = err instanceof AnkiConnectError ? err : null;
      return {
        ok: false,
        kind: e?.kind ?? "unknown",
        message: e?.message ?? String(err),
      };
    }
  }, [anki.url]);

  const sendCard = useCallback(
    async (args: SendCardArgs): Promise<SendResult> => {
      if (!anki.enabled) {
        throw new SendError("config", "AnkiConnect integration is disabled.");
      }
      if (!anki.deck || !anki.model) {
        throw new SendError(
          "config",
          "Set a deck and note type in Anki settings first.",
        );
      }
      if (!anki.fields.sentence || !anki.fields.image) {
        throw new SendError(
          "config",
          "Set sentence and image field names in Anki settings first.",
        );
      }

      let captureRes: Response;
      try {
        captureRes = await fetch("/api/anki/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mangaId: args.mangaId,
            volumeNumber: args.volumeNumber,
            pageIdx: args.pageIdx,
            box: args.blockBox,
            padding: anki.cropPadding,
            format: anki.imageFormat,
            quality: anki.jpegQuality,
          }),
        });
      } catch (err) {
        throw new SendError(
          "unknown",
          `Capture request failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      if (!captureRes.ok) {
        const detail = await captureRes.text().catch(() => "");
        throw new SendError(
          "unknown",
          `Capture failed (${captureRes.status})${detail ? `: ${detail}` : ""}`,
        );
      }
      const capture = (await captureRes.json()) as {
        data: string;
        filename: string;
      };

      let storedFilename: string;
      try {
        storedFilename = await storeMediaFile(
          anki.url,
          capture.filename,
          capture.data,
        );
      } catch (err) {
        throw toSendError(err);
      }

      const sentence = stripLinebreaks(args.blockText);
      const imageHtml = `<img src="${storedFilename}">`;
      const sourceText = `${args.mangaTitle} Vol ${args.volumeNumber} p${args.pageIdx + 1}`;

      const fields: Record<string, string> = {
        [anki.fields.sentence]: sentence,
        [anki.fields.image]: imageHtml,
      };
      if (anki.fields.source) {
        fields[anki.fields.source] = sourceText;
      }
      if (anki.fields.definition && args.definition) {
        fields[anki.fields.definition] = args.definition;
      }

      const tags = expandTags(anki.tags, {
        series: args.mangaTitle,
        volume: args.volumeNumber,
        page: args.pageIdx + 1,
      });

      try {
        if (anki.mode === "update-last") {
          const noteId = await findLastNoteInDeck(anki.url, anki.deck);
          if (noteId === null) {
            throw new SendError(
              "config",
              `No notes found in deck "${anki.deck}" to update.`,
            );
          }
          await updateNoteFields(anki.url, noteId, fields);
          return { noteId, mode: "update-last", deck: anki.deck };
        }
        const noteId = await addNote(anki.url, {
          deck: anki.deck,
          model: anki.model,
          fields,
          tags,
        });
        return { noteId, mode: "create", deck: anki.deck };
      } catch (err) {
        throw toSendError(err);
      }
    },
    [anki],
  );

  return { settings: anki, enabled: anki.enabled, testConnection, sendCard };
}

function toSendError(err: unknown): SendError {
  if (err instanceof SendError) return err;
  if (err instanceof AnkiConnectError) {
    return new SendError(err.kind, err.message);
  }
  return new SendError("unknown", err instanceof Error ? err.message : String(err));
}

export function formatSendError(err: SendError): string {
  switch (err.kind) {
    case "config":
      return err.message;
    case "cors":
      return "Anki blocked this origin. Add it to webCorsOriginList in AnkiConnect's config.";
    case "offline":
      return "Anki isn't reachable. Confirm Anki is running with AnkiConnect installed.";
    case "rejected":
      return `Anki rejected the card: ${err.message}`;
    default:
      return `Anki: ${err.message}`;
  }
}
