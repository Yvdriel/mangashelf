// Verb / adjective class bitfield. Bits track what classes a candidate form
// can inhabit during deinflection BFS. Mirrors Yomitan's condition flag set
// (ext/js/language/ja/japanese-transforms.js) at version 24.x.

export const COND = {
  V1: 1 << 0, // ichidan verbs (る-verbs ending in える/いる) and stems
  V5: 1 << 1, // godan verbs (う-verbs)
  VK: 1 << 2, // 来る (kuru)
  VS: 1 << 3, // する and -する compounds
  VZ: 1 << 4, // ずる verbs (rare; Yomitan tracks them separately)
  ADJ_I: 1 << 5,
  IRU: 1 << 6, // -て + いる auxiliary
  ANY_VERB: 0,
  ANY: 0,
} as const;

// `ANY_VERB` matches every verb class so that rules tagged "any verb"
// (e.g. -て form) accept all sources.
(COND as { ANY_VERB: number }).ANY_VERB =
  COND.V1 | COND.V5 | COND.VK | COND.VS | COND.VZ;
(COND as { ANY: number }).ANY =
  COND.ANY_VERB | COND.ADJ_I | COND.IRU;

// Map from Yomitan term-bank `rules` tags (e.g. "v1", "v5", "adj-i") into the
// bitfield. Words with no rule string match ANY (they aren't conjugatable, so
// their form is the dictionary form and only the zero-deinflection candidate
// can hit them).
export function rulesToConditions(rules: readonly string[]): number {
  if (rules.length === 0) return COND.ANY;
  let mask = 0;
  for (const r of rules) {
    switch (r) {
      case "v1":
      case "v1d":
      case "v1p":
        mask |= COND.V1;
        break;
      case "v5":
      case "v5d":
        mask |= COND.V5;
        break;
      case "vk":
        mask |= COND.VK;
        break;
      case "vs":
        mask |= COND.VS;
        break;
      case "vz":
        mask |= COND.VZ;
        break;
      case "adj-i":
        mask |= COND.ADJ_I;
        break;
      case "iru":
        mask |= COND.IRU;
        break;
      default:
        // Unknown tag: don't constrain.
        mask |= COND.ANY;
        break;
    }
  }
  return mask || COND.ANY;
}
