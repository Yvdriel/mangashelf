import type { DeinflectedForm } from "../types";

// A single suffix-substitution rule. `kanaIn` must match the tail of the
// source term; `kanaOut` replaces it. `conditionsIn` is intersected with the
// candidate's running conditions to decide whether the rule may apply, and
// `conditionsOut` becomes the new candidate's conditions.
//
// `kanaIn === ""` is allowed for whole-word rules; in that case the rule
// matches every term.
export interface SuffixRule {
  reason: string;
  kanaIn: string;
  kanaOut: string;
  conditionsIn: number;
  conditionsOut: number;
}

const MAX_DEPTH = 8;

export class LanguageTransformer {
  private readonly rules: ReadonlyArray<SuffixRule>;

  constructor(rules: ReadonlyArray<SuffixRule>) {
    this.rules = rules;
  }

  transform(text: string, anyMask: number): DeinflectedForm[] {
    const out: DeinflectedForm[] = [
      { term: text, reasons: [], conditions: anyMask },
    ];
    const seen = new Set<string>([key(text, anyMask)]);

    let depth = 0;
    let prevLen = 0;
    while (depth < MAX_DEPTH && out.length > prevLen) {
      const upper = out.length;
      for (let i = prevLen; i < upper; i++) {
        const cand = out[i];
        for (const rule of this.rules) {
          if ((cand.conditions & rule.conditionsIn) === 0) continue;
          const tail = rule.kanaIn;
          if (tail.length > cand.term.length) continue;
          if (tail !== "" && !cand.term.endsWith(tail)) continue;
          const newTerm =
            cand.term.slice(0, cand.term.length - tail.length) + rule.kanaOut;
          if (newTerm.length === 0) continue;
          const k = key(newTerm, rule.conditionsOut);
          if (seen.has(k)) continue;
          seen.add(k);
          out.push({
            term: newTerm,
            conditions: rule.conditionsOut,
            reasons: [...cand.reasons, rule.reason],
          });
        }
      }
      prevLen = upper;
      depth++;
    }
    return out;
  }
}

function key(term: string, conditions: number): string {
  return `${term}|${conditions}`;
}
