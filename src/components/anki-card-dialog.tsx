"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { SendError, formatSendError, useAnki } from "@/hooks/use-anki";
import type { MokuroBlock } from "@/components/ocr-overlay";
import { useTheme } from "@/contexts/theme";

export interface AnkiCardDialogTarget {
  block: MokuroBlock;
  pageIdx: number;
}

interface AnkiCardDialogProps {
  open: boolean;
  target: AnkiCardDialogTarget | null;
  mangaId: number;
  volumeNumber: number;
  mangaTitle: string;
  onClose: () => void;
}

export function AnkiCardDialog({
  open,
  target,
  mangaId,
  volumeNumber,
  mangaTitle,
  onClose,
}: AnkiCardDialogProps) {
  const { sendCard } = useAnki();
  const fullText = useMemo(
    () => (target ? target.block.lines.join("\n") : ""),
    [target],
  );
  const bubbleRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<string>("");
  const [definition, setDefinition] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Reset state on each open.
  useEffect(() => {
    if (open) {
      setSelection("");
      setDefinition("");
      setSubmitting(false);
    }
  }, [open, target]);

  // Track current text selection if it falls inside the bubble container.
  useEffect(() => {
    if (!open) return;
    function onSelectionChange() {
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setSelection("");
        return;
      }
      const node = sel.anchorNode;
      const container = bubbleRef.current;
      if (!container || !node || !container.contains(node)) {
        return;
      }
      setSelection(sel.toString());
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const useWholeSentence = useCallback(() => {
    setSelection("");
    const sel = document.getSelection();
    sel?.removeAllRanges();
  }, []);

  const submit = useCallback(async () => {
    if (!target) return;
    const cardText = (selection.trim() ? selection : fullText).trim();
    if (!cardText) {
      toast.error("Nothing to send: bubble is empty.");
      return;
    }
    setSubmitting(true);
    const id = toast.loading("Sending to Anki…");
    try {
      const result = await sendCard({
        mangaId,
        volumeNumber,
        mangaTitle,
        pageIdx: target.pageIdx,
        blockText: cardText,
        blockBox: target.block.box,
        definition: definition || undefined,
      });
      toast.success(
        result.mode === "create"
          ? `Card added to ${result.deck}`
          : `Updated last card in ${result.deck}`,
        { id },
      );
      onClose();
    } catch (err) {
      const message =
        err instanceof SendError ? formatSendError(err) : String(err);
      toast.error(message, { id, duration: 8000 });
    } finally {
      setSubmitting(false);
    }
  }, [
    target,
    selection,
    fullText,
    sendCard,
    mangaId,
    volumeNumber,
    mangaTitle,
    definition,
    onClose,
  ]);

  const { theme } = useTheme();

  if (!open || !target) return null;

  const effectiveText = selection.trim() ? selection : fullText;

  // Portal to <body> + apply user-selected theme so the reader's hardcoded
  // `data-theme="dark"` wrapper doesn't leak into the dialog. `surface-*` /
  // `accent-*` token values resolve from this attribute.
  return createPortal(
    <div
      data-theme={theme}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60! pt-[15vh] text-surface-50"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="mx-4 w-full max-w-md overflow-hidden rounded-xl border border-surface-600 bg-surface-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-600 px-5 py-4">
          <h3 className="text-sm font-semibold text-surface-50">
            Create Anki card
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-surface-300 hover:bg-surface-700 hover:text-surface-50"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-surface-400">
              Bubble &mdash; drag to select a word or sentence
            </p>
            <div
              ref={bubbleRef}
              lang="ja"
              tabIndex={0}
              className="rounded-lg border border-surface-600 bg-surface-900/50 px-3 py-2 text-base leading-relaxed text-surface-50 whitespace-pre-wrap break-words select-text"
              style={{
                fontFamily:
                  "'Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif",
                userSelect: "text",
              }}
            >
              {fullText}
            </div>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-surface-400">
                Card front
              </p>
              <p
                lang="ja"
                className="mt-1 truncate text-sm text-surface-100"
                title={effectiveText}
              >
                {effectiveText || "—"}
              </p>
            </div>
            {selection.trim() && (
              <button
                type="button"
                onClick={useWholeSentence}
                className="shrink-0 rounded-md border border-surface-500 px-2 py-1 text-xs text-surface-200 hover:bg-surface-700"
              >
                Use whole sentence
              </button>
            )}
          </div>

          <DefinitionPanel
            query={effectiveText}
            onDefinitionChange={setDefinition}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-surface-600 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-surface-500 px-4 py-2 text-sm font-medium text-surface-200 transition-colors hover:bg-surface-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !effectiveText.trim()}
            className="rounded-lg bg-accent-400 px-4 py-2 text-sm font-medium text-surface-900 transition-colors hover:bg-accent-300 disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Create card"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface DictEntry {
  headword: string;
  reading: string;
  common: boolean;
  pos: string[];
  glosses: string[];
}

interface TokenLookup {
  surface: string;
  lemma: string;
  reading?: string;
  entries: DictEntry[];
}

interface LookupResponse {
  tokens?: TokenLookup[];
  error?: string;
}

const LOOKUP_DEBOUNCE_MS = 200;

function buildDefinitionString(token: TokenLookup | null): string {
  if (!token) return "";
  const e = token.entries[0];
  if (!e) return "";
  const reading = e.reading && e.reading !== e.headword ? ` (${e.reading})` : "";
  const glossLine = e.glosses.slice(0, 2).join(" / ");
  return `${e.headword}${reading} — ${glossLine}`;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; tokens: TokenLookup[] };

function DefinitionPanel({
  query,
  onDefinitionChange,
}: {
  query: string;
  onDefinitionChange: (def: string) => void;
}) {
  const trimmed = query.trim();
  const [state, setState] = useState<LoadState | null>(null);
  const [primaryIdx, setPrimaryIdx] = useState(0);

  // Debounced fetch with AbortController. Empty query => no fetch; the parent
  // render path renders the idle case directly so we don't setState here.
  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState({ kind: "loading" });
      try {
        const res = await fetch("/api/dict/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
          signal: controller.signal,
        });
        const data = (await res.json()) as LookupResponse;
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setState({
            kind: "error",
            message: data.error || `Lookup failed (${res.status})`,
          });
          return;
        }
        setState({ kind: "ok", tokens: data.tokens || [] });
        setPrimaryIdx(0);
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }, LOOKUP_DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [trimmed]);

  // Push the chosen definition upward whenever the primary token changes.
  useEffect(() => {
    if (!state || state.kind !== "ok") {
      onDefinitionChange("");
      return;
    }
    const token = state.tokens[primaryIdx] ?? null;
    onDefinitionChange(buildDefinitionString(token));
  }, [state, primaryIdx, onDefinitionChange]);

  return (
    <div className="rounded-lg border border-surface-600 bg-surface-900/30 px-3 py-3 min-h-[5.5rem]">
      <p className="mb-2 text-xs uppercase tracking-wide text-surface-400">
        Dictionary
      </p>
      {!trimmed && (
        <p className="text-xs text-surface-400">
          Drag-select a word in the bubble or use the whole sentence.
        </p>
      )}
      {trimmed && (!state || state.kind === "loading") && (
        <p className="text-xs text-surface-400">Looking up…</p>
      )}
      {trimmed && state?.kind === "error" && (
        <p className="text-xs text-red-400">{state.message}</p>
      )}
      {trimmed && state?.kind === "ok" && state.tokens.length === 0 && (
        <p className="text-xs text-surface-400">No matches in JMdict.</p>
      )}
      {trimmed && state?.kind === "ok" && state.tokens.length > 0 && (
        <ul className="space-y-1.5">
          {state.tokens.map((tok, i) => {
            const e = tok.entries[0];
            const isPrimary = i === primaryIdx;
            return (
              <li key={`${tok.lemma}-${i}`}>
                <button
                  type="button"
                  onClick={() => setPrimaryIdx(i)}
                  className={`w-full text-left rounded-md px-2 py-1.5 transition-colors ${
                    isPrimary
                      ? "bg-accent-400/15 ring-1 ring-accent-400/50"
                      : "hover:bg-surface-700"
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span lang="ja" className="text-sm text-surface-50">
                      {e?.headword ?? tok.lemma}
                    </span>
                    {e?.reading && e.reading !== e.headword && (
                      <span lang="ja" className="text-xs text-surface-300">
                        {e.reading}
                      </span>
                    )}
                    {isPrimary && (
                      <span className="ml-auto text-[10px] uppercase tracking-wide text-accent-200">
                        Card back
                      </span>
                    )}
                  </div>
                  {e?.glosses && e.glosses.length > 0 && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-surface-200">
                      {e.glosses.slice(0, 2).join(" / ")}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-surface-500">
        Definitions from JMdict (EDRDG).
      </p>
    </div>
  );
}
