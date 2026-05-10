"use client";

import {
  Fragment,
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { SendError, formatSendError, useAnki } from "@/hooks/use-anki";
import type { MokuroBlock } from "@/components/ocr-overlay";
import { useTheme } from "@/contexts/theme";
import { getDictClient } from "@/lib/dict/client";
import type {
  GlossaryNode,
  KanjiRecord,
  ScanResult,
  StructuredContent,
  TermHit,
  TermRecord,
} from "@/lib/dict/types";

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

  return createPortal(
    <div
      data-theme={theme}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60! pt-[10vh] text-surface-50"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="mx-4 w-full max-w-2xl overflow-hidden rounded-xl border border-surface-600 bg-surface-800 shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
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

        <div className="space-y-4 px-5 py-4 overflow-y-auto">
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

const LOOKUP_DEBOUNCE_MS = 200;

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; results: ScanResult[] };

function DefinitionPanel({
  query,
  onDefinitionChange,
}: {
  query: string;
  onDefinitionChange: (def: string) => void;
}) {
  const trimmed = query.trim();
  const [state, setState] = useState<LoadState | null>(null);
  // Index of selected token in the token stream + selected hit + selected sense.
  const [tokenIdx, setTokenIdx] = useState(0);
  const [hitIdx, setHitIdx] = useState(0);
  const [senseIdx, setSenseIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!trimmed) {
      setState(null);
      onDefinitionChange("");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState({ kind: "loading" });
      try {
        const results = await getDictClient().scanText(trimmed, controller.signal);
        if (controller.signal.aborted) return;
        setState({ kind: "ok", results });
        // Default selection: first token with any hits.
        const firstHit = results.findIndex((r) => r.hits.length > 0);
        setTokenIdx(firstHit < 0 ? 0 : firstHit);
        setHitIdx(0);
        setSenseIdx(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
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
  }, [trimmed, onDefinitionChange]);

  // Push the chosen card-back HTML upward.
  useEffect(() => {
    if (!state || state.kind !== "ok") {
      onDefinitionChange("");
      return;
    }
    const token = state.results[tokenIdx];
    if (!token || token.hits.length === 0) {
      onDefinitionChange("");
      return;
    }
    const hit = token.hits[hitIdx] ?? token.hits[0];
    onDefinitionChange(buildCardBack(hit, senseIdx));
  }, [state, tokenIdx, hitIdx, senseIdx, onDefinitionChange]);

  if (!trimmed) {
    return (
      <div className="rounded-lg border border-surface-600 bg-surface-900/30 px-3 py-3 min-h-[5.5rem]">
        <p className="mb-1 text-xs uppercase tracking-wide text-surface-400">
          Dictionary
        </p>
        <p className="text-xs text-surface-400">
          Drag-select a word in the bubble or use the whole sentence.
        </p>
      </div>
    );
  }

  if (!state || state.kind === "loading") {
    return (
      <div className="rounded-lg border border-surface-600 bg-surface-900/30 px-3 py-3 min-h-[5.5rem]">
        <p className="mb-1 text-xs uppercase tracking-wide text-surface-400">
          Dictionary
        </p>
        <p className="text-xs text-surface-400">Looking up…</p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="rounded-lg border border-surface-600 bg-surface-900/30 px-3 py-3 min-h-[5.5rem]">
        <p className="mb-1 text-xs uppercase tracking-wide text-surface-400">
          Dictionary
        </p>
        <p className="text-xs text-red-400">{state.message}</p>
      </div>
    );
  }

  const results = state.results;
  const anyHits = results.some((r) => r.hits.length > 0);
  const selectedToken = results[tokenIdx];
  const selectedHit = selectedToken?.hits[hitIdx];

  return (
    <div className="rounded-lg border border-surface-600 bg-surface-900/30 px-3 py-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-surface-400">
        Dictionary
      </p>
      {!anyHits && (
        <p className="text-xs text-surface-400">
          No matches. Install dictionaries from Settings.
        </p>
      )}
      {anyHits && (
        <>
          <TokenStream
            results={results}
            selectedTokenIdx={tokenIdx}
            onSelect={(i) => {
              setTokenIdx(i);
              setHitIdx(0);
              setSenseIdx(null);
            }}
          />
          {selectedToken && selectedHit && (
            <RichResult
              token={selectedToken}
              hits={selectedToken.hits}
              hitIdx={hitIdx}
              senseIdx={senseIdx}
              onPickHit={(i) => {
                setHitIdx(i);
                setSenseIdx(null);
              }}
              onPickSense={(i) => setSenseIdx(i)}
            />
          )}
        </>
      )}
    </div>
  );
}

function TokenStream({
  results,
  selectedTokenIdx,
  onSelect,
}: {
  results: ScanResult[];
  selectedTokenIdx: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div
      lang="ja"
      className="mb-3 rounded-md bg-surface-800 px-3 py-2 leading-relaxed text-base"
      style={{
        fontFamily: "'Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif",
      }}
    >
      {results.map((r, i) => {
        const hasHit = r.hits.length > 0;
        const isSelected = i === selectedTokenIdx;
        if (!hasHit) {
          return (
            <span key={`${r.position}-${i}`} className="text-surface-300">
              {r.surface}
            </span>
          );
        }
        return (
          <button
            key={`${r.position}-${i}`}
            type="button"
            onClick={() => onSelect(i)}
            className={`rounded px-0.5 transition-colors ${
              isSelected
                ? "bg-accent-400/25 ring-1 ring-accent-400/60 text-surface-50"
                : "text-surface-50 hover:bg-surface-700"
            }`}
            title={r.hits[0].record.expression}
          >
            {r.surface}
          </button>
        );
      })}
    </div>
  );
}

function RichResult({
  token,
  hits,
  hitIdx,
  senseIdx,
  onPickHit,
  onPickSense,
}: {
  token: ScanResult;
  hits: TermHit[];
  hitIdx: number;
  senseIdx: number | null;
  onPickHit: (i: number) => void;
  onPickSense: (i: number) => void;
}) {
  const hit = hits[hitIdx];
  if (!hit) return null;
  const reasons = hit.reasons.length > 0 ? hit.reasons.join(" · ") : null;
  const cleanDefTags = hit.record.definitionTags.filter(
    (t) => t && t !== "*",
  );

  return (
    <div className="space-y-3">
      {hits.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {hits.map((h, i) => (
            <button
              key={`${h.record.expression}-${h.record.dict}-${i}`}
              type="button"
              onClick={() => onPickHit(i)}
              className={`rounded px-2 py-1 text-xs ${
                i === hitIdx
                  ? "bg-accent-400/15 ring-1 ring-accent-400/50 text-surface-50"
                  : "border border-surface-600 text-surface-200 hover:bg-surface-700"
              }`}
            >
              <span lang="ja">{h.record.expression}</span>
              {h.record.reading && h.record.reading !== h.record.expression && (
                <span lang="ja" className="ml-1 text-surface-300">
                  {h.record.reading}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-md bg-surface-800 p-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span lang="ja" className="text-xl font-semibold text-surface-50">
            {hit.record.expression}
          </span>
          {hit.record.reading && hit.record.reading !== hit.record.expression && (
            <span lang="ja" className="text-sm text-surface-300">
              【{hit.record.reading}】
            </span>
          )}
          {hit.frequency !== null && (
            <span className="ml-auto text-[10px] uppercase tracking-wide text-surface-400">
              freq #{hit.frequency.toLocaleString()}
            </span>
          )}
        </div>
        {reasons && (
          <p className="mt-1 text-[11px] text-surface-400">
            <span lang="ja">{token.surface}</span> → {reasons}
          </p>
        )}
        {cleanDefTags.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-1">
            {cleanDefTags.map((t, i) => (
              <span
                key={i}
                className="rounded border border-surface-600 bg-surface-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-surface-200"
              >
                {t}
              </span>
            ))}
          </p>
        )}
        <ol className="mt-3 list-decimal pl-5 space-y-2 text-sm text-surface-100 marker:text-surface-400">
          {hit.record.glossary.map((g, i) => {
            const isSelected = senseIdx === i;
            return (
              <li
                key={i}
                className={`dict-glossary cursor-pointer rounded px-1 py-0.5 ${
                  isSelected
                    ? "bg-accent-400/15 ring-1 ring-accent-400/40"
                    : "hover:bg-surface-700/30"
                }`}
                onClick={() => onPickSense(i)}
                title={
                  isSelected
                    ? "Card uses this sense"
                    : "Click to use just this sense for the card"
                }
              >
                <Glossary node={g} />
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-[10px] text-surface-500">{hit.dictTitle}</p>
      </div>

      {token.kanji.length > 0 && <KanjiStrip kanji={token.kanji} />}
    </div>
  );
}

function Glossary({ node }: { node: GlossaryNode }) {
  if (typeof node === "string") return <span>{node}</span>;
  if ("type" in node) {
    if (node.type === "text") return <span>{node.text}</span>;
    if (node.type === "structured-content") {
      return <StructuredContentRenderer content={node.content} />;
    }
  }
  return null;
}

// Allowlist mirrors Yomitan's structured-content schema. We intentionally drop
// `img` (no media support yet) and any `a` href becomes a non-clickable span
// because card creation is the only relevant interaction here.
const ALLOWED_TAGS = new Set([
  "br",
  "ruby",
  "rt",
  "rp",
  "ul",
  "ol",
  "li",
  "div",
  "span",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "details",
  "summary",
]);

// Yomitan annotates structured-content nodes via `data` attributes (e.g.
// `data-content="tag"` for POS-tag pills, `data-jitendex="..."` for Jitendex
// sections). We surface these as Tailwind-targetable classNames so styling
// can hook into them without us modeling every dictionary's quirks.
function dataToClassName(
  data: Record<string, string> | undefined,
): string | undefined {
  if (!data) return undefined;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    parts.push(`sc-${k}-${cssSafe(v)}`);
    parts.push(`sc-${k}`);
  }
  return parts.join(" ");
}

function cssSafe(v: string): string {
  return v.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function StructuredContentRenderer({
  content,
}: {
  content: StructuredContent;
}): ReactNode {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((c, i) => (
      <Fragment key={i}>
        <StructuredContentRenderer content={c} />
      </Fragment>
    ));
  }
  if (typeof content !== "object" || content === null) return null;
  const { tag, content: inner, data, lang, style } = content;
  if (!ALLOWED_TAGS.has(tag)) return null;
  if (tag === "br") return <br />;
  const className = dataToClassName(data);
  // Strip Yomitan-supplied colors so they don't fight our dark theme; keep
  // structural styles like font-style / list-style.
  let safeStyle: CSSProperties | undefined;
  if (style) {
    safeStyle = {};
    for (const [k, v] of Object.entries(style)) {
      const key = k as keyof CSSProperties;
      if (key === "color" || key === "background" || key === "backgroundColor") continue;
      (safeStyle as Record<string, unknown>)[key] = v;
    }
  }
  const children =
    inner !== undefined ? (
      <StructuredContentRenderer content={inner} />
    ) : null;
  return createElement(
    tag,
    { className, style: safeStyle, lang },
    children,
  );
}


function KanjiStrip({ kanji }: { kanji: KanjiRecord[] }) {
  return (
    <div className="rounded-md bg-surface-800 p-3">
      <p className="mb-2 text-[10px] uppercase tracking-wide text-surface-400">
        Kanji
      </p>
      <ul className="space-y-2">
        {kanji.map((k) => (
          <li key={k.character} className="flex gap-3">
            <span lang="ja" className="text-2xl text-surface-50 leading-none">
              {k.character}
            </span>
            <div className="text-xs">
              {k.onyomi.length > 0 && (
                <p className="text-surface-300">
                  <span className="text-surface-500">音:</span>{" "}
                  <span lang="ja">{k.onyomi.join("、")}</span>
                </p>
              )}
              {k.kunyomi.length > 0 && (
                <p className="text-surface-300">
                  <span className="text-surface-500">訓:</span>{" "}
                  <span lang="ja">{k.kunyomi.join("、")}</span>
                </p>
              )}
              {k.meanings.length > 0 && (
                <p className="text-surface-100">{k.meanings.slice(0, 6).join(", ")}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Card-back HTML. Anki note fields accept HTML; we keep the user's
// dictionary structure (POS-tag pills, gloss list, examples, see-also) by
// serializing the same allowlist the in-app renderer uses.
function buildCardBack(hit: TermHit, senseIdx: number | null): string {
  const expr = escapeHTML(hit.record.expression);
  const reading =
    hit.record.reading && hit.record.reading !== hit.record.expression
      ? `<span style="opacity:.75;font-weight:normal"> 【${escapeHTML(
          hit.record.reading,
        )}】</span>`
      : "";
  const senses =
    senseIdx !== null
      ? [hit.record.glossary[senseIdx]].filter(Boolean)
      : hit.record.glossary;
  const senseHTML = senses
    .map((g) => `<li style="margin:.25em 0">${renderGlossaryHTML(g)}</li>`)
    .join("");
  const cleanTags = hit.record.definitionTags.filter((t) => t && t !== "*");
  const pos =
    cleanTags.length > 0
      ? `<div style="margin:.2em 0;font-size:.78em;opacity:.7;text-transform:lowercase">${cleanTags
          .map(escapeHTML)
          .join(" · ")}</div>`
      : "";
  const freq =
    hit.frequency !== null
      ? ` · freq #${hit.frequency.toLocaleString()}`
      : "";
  const meta = `<div style="opacity:.6;font-size:.78em;margin-top:.4em">${escapeHTML(
    hit.dictTitle,
  )}${freq}</div>`;
  // Wrap in inline-block so the parent's `text-align:center` (set on .card)
  // can center the whole block while the gloss list's bullets/numbers stay
  // left-anchored within the wrapper.
  const inner = [
    `<div lang="ja" style="font-size:1.1em"><b>${expr}</b>${reading}</div>`,
    pos,
    `<ol style="margin:.3em 0 .3em 1.4em;padding:0;text-align:left">${senseHTML}</ol>`,
    meta,
  ]
    .filter(Boolean)
    .join("");
  return `<div style="display:inline-block;text-align:left;max-width:90%">${inner}</div>`;
}

function renderGlossaryHTML(g: GlossaryNode): string {
  if (typeof g === "string") return escapeHTML(g);
  if ("type" in g) {
    if (g.type === "text") return escapeHTML(g.text);
    if (g.type === "structured-content") {
      return renderStructuredHTML(g.content);
    }
  }
  return "";
}

function renderStructuredHTML(content: StructuredContent): string {
  if (typeof content === "string") return escapeHTML(content);
  if (Array.isArray(content)) {
    return content.map(renderStructuredHTML).join("");
  }
  if (typeof content !== "object" || content === null) return "";
  const { tag, content: inner, data, lang, style } = content;
  if (!ALLOWED_TAGS.has(tag)) return "";
  if (tag === "br") return "<br>";
  const className = dataToClassName(data);
  const styleStr = serializeStyle(style);
  const attrs: string[] = [];
  if (className) attrs.push(`class="${escapeHTML(className)}"`);
  if (styleStr) attrs.push(`style="${escapeHTML(styleStr)}"`);
  if (lang) attrs.push(`lang="${escapeHTML(lang)}"`);
  const open = attrs.length > 0 ? `<${tag} ${attrs.join(" ")}>` : `<${tag}>`;
  const innerHTML = inner !== undefined ? renderStructuredHTML(inner) : "";
  return `${open}${innerHTML}</${tag}>`;
}

function serializeStyle(
  style: Record<string, string | number> | undefined,
): string {
  if (!style) return "";
  const out: string[] = [];
  for (const [k, v] of Object.entries(style)) {
    if (k === "color" || k === "background" || k === "backgroundColor") continue;
    const kebab = k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    out.push(`${kebab}:${v}`);
  }
  return out.join(";");
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// `TermRecord` is referenced indirectly via TermHit. Re-export to silence
// the unused-import lint when bundlers strip type-only imports.
export type { TermRecord };
