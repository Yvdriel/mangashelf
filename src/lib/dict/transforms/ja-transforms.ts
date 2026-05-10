// Japanese deinflection rule table. Suffix-substitution semantics: see
// `language-transformer.ts`. Modeled on Yomitan's
// `ext/js/language/ja/japanese-transforms.js` (MIT) but compressed to the
// classes / forms we need: past, te-form, negative, polite, causative,
// passive, causative-passive, desiderative (-tai), volitional, potential,
// conditional, imperative, plus i-adjective negative/past/te.

import type { SuffixRule } from "./language-transformer";
import { COND } from "./conditions";

// Godan kana-row groupings: each row is the [u]-row → [i]-row → [a]-row →
// [e]-row → [o]-row mapping for the consonant column. Used to expand rules
// that depend on the godan stem-row.
//
// Order: [u, i, a, e, o].
const GODAN_ROWS: ReadonlyArray<readonly [string, string, string, string, string]> = [
  ["う", "い", "わ", "え", "お"], // -u (note: negative uses わ, not あ)
  ["く", "き", "か", "け", "こ"], // -ku
  ["ぐ", "ぎ", "が", "げ", "ご"], // -gu
  ["す", "し", "さ", "せ", "そ"], // -su
  ["つ", "ち", "た", "て", "と"], // -tsu
  ["ぬ", "に", "な", "ね", "の"], // -nu
  ["ぶ", "び", "ば", "べ", "ぼ"], // -bu
  ["む", "み", "ま", "め", "も"], // -mu
  ["る", "り", "ら", "れ", "ろ"], // -ru
];

// Godan past tense by consonant-column. The te-form mirror has the same
// pattern but with て/で instead of た/だ. We index this table for both.
//
// Pairs: [past-suffix, dictionary-suffix, te-suffix].
const GODAN_PAST_TE: ReadonlyArray<readonly [string, string, string]> = [
  ["った", "う", "って"], // 言う → 言った, 言って
  ["いた", "く", "いて"], // 書く → 書いた, 書いて
  ["いだ", "ぐ", "いで"], // 泳ぐ → 泳いだ, 泳いで
  ["した", "す", "して"], // 話す → 話した, 話して
  ["った", "つ", "って"], // 立つ → 立った, 立って
  ["んだ", "ぬ", "んで"], // 死ぬ → 死んだ, 死んで
  ["んだ", "ぶ", "んで"], // 飛ぶ → 飛んだ, 飛んで
  ["んだ", "む", "んで"], // 飲む → 飲んだ, 飲んで
  ["った", "る", "って"], // 走る → 走った, 走って
];

const rules: SuffixRule[] = [];

function add(r: SuffixRule) {
  rules.push(r);
}

// --- Past (-た / -だ) ---
add({ reason: "past", kanaIn: "た", kanaOut: "る", conditionsIn: COND.ANY, conditionsOut: COND.V1 });
for (const [past, dict] of GODAN_PAST_TE) {
  add({ reason: "past", kanaIn: past, kanaOut: dict, conditionsIn: COND.ANY, conditionsOut: COND.V5 });
}
add({ reason: "past", kanaIn: "きた", kanaOut: "くる", conditionsIn: COND.ANY, conditionsOut: COND.VK });
add({ reason: "past", kanaIn: "した", kanaOut: "する", conditionsIn: COND.ANY, conditionsOut: COND.VS });
add({ reason: "-i past", kanaIn: "かった", kanaOut: "い", conditionsIn: COND.ANY, conditionsOut: COND.ADJ_I });

// --- Te-form ---
add({ reason: "-te", kanaIn: "て", kanaOut: "る", conditionsIn: COND.ANY, conditionsOut: COND.V1 });
for (const [, dict, te] of GODAN_PAST_TE) {
  add({ reason: "-te", kanaIn: te, kanaOut: dict, conditionsIn: COND.ANY, conditionsOut: COND.V5 });
}
add({ reason: "-te", kanaIn: "きて", kanaOut: "くる", conditionsIn: COND.ANY, conditionsOut: COND.VK });
add({ reason: "-te", kanaIn: "して", kanaOut: "する", conditionsIn: COND.ANY, conditionsOut: COND.VS });
add({ reason: "-i te", kanaIn: "くて", kanaOut: "い", conditionsIn: COND.ANY, conditionsOut: COND.ADJ_I });

// --- Negative (-ない) ---
add({ reason: "negative", kanaIn: "ない", kanaOut: "る", conditionsIn: COND.ANY, conditionsOut: COND.V1 });
for (const row of GODAN_ROWS) {
  // negative: stem [a]-row + ない → [u]-row dict form
  // (note: う-godans use わ in negative; row[2] already encodes that)
  add({ reason: "negative", kanaIn: row[2] + "ない", kanaOut: row[0], conditionsIn: COND.ANY, conditionsOut: COND.V5 });
}
add({ reason: "negative", kanaIn: "こない", kanaOut: "くる", conditionsIn: COND.ANY, conditionsOut: COND.VK });
add({ reason: "negative", kanaIn: "しない", kanaOut: "する", conditionsIn: COND.ANY, conditionsOut: COND.VS });
add({ reason: "-i negative", kanaIn: "くない", kanaOut: "い", conditionsIn: COND.ANY, conditionsOut: COND.ADJ_I });

// --- Polite -ます (and negatives -ません/-ませんでした) ---
add({ reason: "polite", kanaIn: "ます", kanaOut: "る", conditionsIn: COND.ANY, conditionsOut: COND.V1 });
add({ reason: "polite", kanaIn: "ません", kanaOut: "る", conditionsIn: COND.ANY, conditionsOut: COND.V1 });
add({ reason: "polite past", kanaIn: "ました", kanaOut: "る", conditionsIn: COND.ANY, conditionsOut: COND.V1 });
for (const row of GODAN_ROWS) {
  add({ reason: "polite", kanaIn: row[1] + "ます", kanaOut: row[0], conditionsIn: COND.ANY, conditionsOut: COND.V5 });
  add({ reason: "polite", kanaIn: row[1] + "ません", kanaOut: row[0], conditionsIn: COND.ANY, conditionsOut: COND.V5 });
  add({ reason: "polite past", kanaIn: row[1] + "ました", kanaOut: row[0], conditionsIn: COND.ANY, conditionsOut: COND.V5 });
}
add({ reason: "polite", kanaIn: "きます", kanaOut: "くる", conditionsIn: COND.ANY, conditionsOut: COND.VK });
add({ reason: "polite", kanaIn: "します", kanaOut: "する", conditionsIn: COND.ANY, conditionsOut: COND.VS });

// --- Desiderative -たい (i-adjective on the masu-stem) ---
add({ reason: "-tai", kanaIn: "たい", kanaOut: "る", conditionsIn: COND.ANY, conditionsOut: COND.V1 });
for (const row of GODAN_ROWS) {
  add({ reason: "-tai", kanaIn: row[1] + "たい", kanaOut: row[0], conditionsIn: COND.ANY, conditionsOut: COND.V5 });
}
add({ reason: "-tai", kanaIn: "きたい", kanaOut: "くる", conditionsIn: COND.ANY, conditionsOut: COND.VK });
add({ reason: "-tai", kanaIn: "したい", kanaOut: "する", conditionsIn: COND.ANY, conditionsOut: COND.VS });

// --- Causative -せる ---
add({ reason: "causative", kanaIn: "させる", kanaOut: "る", conditionsIn: COND.ANY, conditionsOut: COND.V1 });
for (const row of GODAN_ROWS) {
  add({ reason: "causative", kanaIn: row[2] + "せる", kanaOut: row[0], conditionsIn: COND.ANY, conditionsOut: COND.V5 });
}
add({ reason: "causative", kanaIn: "こさせる", kanaOut: "くる", conditionsIn: COND.ANY, conditionsOut: COND.VK });
add({ reason: "causative", kanaIn: "させる", kanaOut: "する", conditionsIn: COND.ANY, conditionsOut: COND.VS });

// --- Passive -れる ---
add({ reason: "passive", kanaIn: "られる", kanaOut: "る", conditionsIn: COND.ANY, conditionsOut: COND.V1 });
for (const row of GODAN_ROWS) {
  add({ reason: "passive", kanaIn: row[2] + "れる", kanaOut: row[0], conditionsIn: COND.ANY, conditionsOut: COND.V5 });
}
add({ reason: "passive", kanaIn: "こられる", kanaOut: "くる", conditionsIn: COND.ANY, conditionsOut: COND.VK });
add({ reason: "passive", kanaIn: "される", kanaOut: "する", conditionsIn: COND.ANY, conditionsOut: COND.VS });

// --- Causative-passive -せられる (combined) ---
add({ reason: "causative-passive", kanaIn: "させられる", kanaOut: "る", conditionsIn: COND.ANY, conditionsOut: COND.V1 });
for (const row of GODAN_ROWS) {
  add({ reason: "causative-passive", kanaIn: row[2] + "せられる", kanaOut: row[0], conditionsIn: COND.ANY, conditionsOut: COND.V5 });
}
add({ reason: "causative-passive", kanaIn: "こさせられる", kanaOut: "くる", conditionsIn: COND.ANY, conditionsOut: COND.VK });
add({ reason: "causative-passive", kanaIn: "させられる", kanaOut: "する", conditionsIn: COND.ANY, conditionsOut: COND.VS });

// --- Potential -える / -られる (V1 form is identical to passive; we tag it
// separately so the reasons chain reads correctly) ---
add({ reason: "potential", kanaIn: "られる", kanaOut: "る", conditionsIn: COND.ANY, conditionsOut: COND.V1 });
for (const row of GODAN_ROWS) {
  add({ reason: "potential", kanaIn: row[3] + "る", kanaOut: row[0], conditionsIn: COND.ANY, conditionsOut: COND.V5 });
}
add({ reason: "potential", kanaIn: "こられる", kanaOut: "くる", conditionsIn: COND.ANY, conditionsOut: COND.VK });
add({ reason: "potential", kanaIn: "できる", kanaOut: "する", conditionsIn: COND.ANY, conditionsOut: COND.VS });

// --- Volitional -よう / -おう ---
add({ reason: "volitional", kanaIn: "よう", kanaOut: "る", conditionsIn: COND.ANY, conditionsOut: COND.V1 });
for (const row of GODAN_ROWS) {
  add({ reason: "volitional", kanaIn: row[4] + "う", kanaOut: row[0], conditionsIn: COND.ANY, conditionsOut: COND.V5 });
}
add({ reason: "volitional", kanaIn: "こよう", kanaOut: "くる", conditionsIn: COND.ANY, conditionsOut: COND.VK });
add({ reason: "volitional", kanaIn: "しよう", kanaOut: "する", conditionsIn: COND.ANY, conditionsOut: COND.VS });

// --- Conditional -ば ---
add({ reason: "conditional", kanaIn: "れば", kanaOut: "る", conditionsIn: COND.ANY, conditionsOut: COND.V1 });
for (const row of GODAN_ROWS) {
  add({ reason: "conditional", kanaIn: row[3] + "ば", kanaOut: row[0], conditionsIn: COND.ANY, conditionsOut: COND.V5 });
}
add({ reason: "conditional", kanaIn: "くれば", kanaOut: "くる", conditionsIn: COND.ANY, conditionsOut: COND.VK });
add({ reason: "conditional", kanaIn: "すれば", kanaOut: "する", conditionsIn: COND.ANY, conditionsOut: COND.VS });
add({ reason: "-i conditional", kanaIn: "ければ", kanaOut: "い", conditionsIn: COND.ANY, conditionsOut: COND.ADJ_I });

// --- Imperative ---
add({ reason: "imperative", kanaIn: "ろ", kanaOut: "る", conditionsIn: COND.ANY, conditionsOut: COND.V1 });
add({ reason: "imperative", kanaIn: "よ", kanaOut: "る", conditionsIn: COND.ANY, conditionsOut: COND.V1 });
for (const row of GODAN_ROWS) {
  add({ reason: "imperative", kanaIn: row[3], kanaOut: row[0], conditionsIn: COND.ANY, conditionsOut: COND.V5 });
}
add({ reason: "imperative", kanaIn: "こい", kanaOut: "くる", conditionsIn: COND.ANY, conditionsOut: COND.VK });
add({ reason: "imperative", kanaIn: "しろ", kanaOut: "する", conditionsIn: COND.ANY, conditionsOut: COND.VS });
add({ reason: "imperative", kanaIn: "せよ", kanaOut: "する", conditionsIn: COND.ANY, conditionsOut: COND.VS });

// --- Auxiliary しまう (regret/completion). Pattern: V-て + しまう.
// Strip the auxiliary off the te-form and let the te-form rule fire next.
// しまう itself is a godan-u verb so the auxiliary form may also appear with
// its own conjugations (-しまった, -しまって, -しまう, etc.). Because we run
// rules to a fixed point and emit candidates per pass, the simplest port is:
// reduce -てしまう / -でしまう back to the underlying te-form. We add explicit
// rules instead of recursive deinflection of しまう because the user usually
// wants the result tagged "completed" rather than seeing しまう as an entry. ---
add({ reason: "auxiliary -てしまう", kanaIn: "てしまう", kanaOut: "て", conditionsIn: COND.ANY, conditionsOut: COND.ANY });
add({ reason: "auxiliary -でしまう", kanaIn: "でしまう", kanaOut: "で", conditionsIn: COND.ANY, conditionsOut: COND.ANY });
// Spoken contractions: -ちゃう / -じゃう = -てしまう / -でしまう
add({ reason: "auxiliary -ちゃう", kanaIn: "ちゃう", kanaOut: "て", conditionsIn: COND.ANY, conditionsOut: COND.ANY });
add({ reason: "auxiliary -じゃう", kanaIn: "じゃう", kanaOut: "で", conditionsIn: COND.ANY, conditionsOut: COND.ANY });

// --- Progressive / state -ている (full and contracted -てる) ---
add({ reason: "progressive", kanaIn: "ている", kanaOut: "て", conditionsIn: COND.ANY, conditionsOut: COND.ANY });
add({ reason: "progressive", kanaIn: "でいる", kanaOut: "で", conditionsIn: COND.ANY, conditionsOut: COND.ANY });
add({ reason: "progressive", kanaIn: "てる", kanaOut: "て", conditionsIn: COND.ANY, conditionsOut: COND.ANY });
add({ reason: "progressive", kanaIn: "でる", kanaOut: "で", conditionsIn: COND.ANY, conditionsOut: COND.ANY });

export const japaneseTransforms = {
  rules: rules as ReadonlyArray<SuffixRule>,
};
