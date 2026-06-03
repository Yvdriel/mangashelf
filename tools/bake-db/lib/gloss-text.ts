// Flatten a Yomitan GlossaryNode[] into a plain-English string for the gloss_fts
// index. Drops img/rt nodes so furigana readings & images don't pollute the
// English search. Tolerant: unknown shapes flatten to "". Mirrors the recursive
// StructuredContent shape declared in src/lib/dict/types.ts.
import type { GlossaryNode, StructuredContent } from "../../../src/lib/dict/types.ts";

function flattenSC(sc: StructuredContent | undefined): string {
  if (sc == null) return "";
  if (typeof sc === "string") return sc;
  if (Array.isArray(sc)) return sc.map(flattenSC).join(" ");
  // tagged node
  const tag = sc.tag;
  if (tag === "img" || tag === "rt" || tag === "rp") return ""; // skip images + furigana ruby text
  return flattenSC(sc.content);
}

function flattenNode(n: GlossaryNode): string {
  if (typeof n === "string") return n;
  switch (n.type) {
    case "text":
      return n.text;
    case "image":
      return "";
    case "structured-content":
      return flattenSC(n.content);
    default:
      return "";
  }
}

export function flattenGloss(nodes: GlossaryNode[]): string {
  return nodes
    .map(flattenNode)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
