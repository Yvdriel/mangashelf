import { describe, expect, it } from "vitest";
import { LanguageTransformer } from "./language-transformer";
import { japaneseTransforms } from "./ja-transforms";
import { COND } from "./conditions";

const t = new LanguageTransformer(japaneseTransforms.rules);

function reaches(input: string, target: string): boolean {
  const forms = t.transform(input, COND.ANY);
  return forms.some((f) => f.term === target);
}

describe("LanguageTransformer (ja)", () => {
  it("食べさせられた → 食べる (past · causative-passive)", () => {
    expect(reaches("食べさせられた", "食べる")).toBe(true);
  });
  it("走った → 走る (godan-ru past)", () => {
    expect(reaches("走った", "走る")).toBe(true);
  });
  it("美しくない → 美しい (i-adj negative)", () => {
    expect(reaches("美しくない", "美しい")).toBe(true);
  });
  it("してしまった → する (てしまう + past + suru te-form)", () => {
    expect(reaches("してしまった", "する")).toBe(true);
  });
  it("飲みたかった → 飲む (-tai + i-past + godan)", () => {
    expect(reaches("飲みたかった", "飲む")).toBe(true);
  });
  it("書いた → 書く (godan-ku past)", () => {
    expect(reaches("書いた", "書く")).toBe(true);
  });
  it("食べました → 食べる (V1 polite past)", () => {
    expect(reaches("食べました", "食べる")).toBe(true);
  });
  it("飲まない → 飲む (godan negative)", () => {
    expect(reaches("飲まない", "飲む")).toBe(true);
  });
  it("includes the input as the zero-deinflection candidate", () => {
    const forms = t.transform("食べる", COND.ANY);
    expect(forms.some((f) => f.term === "食べる" && f.reasons.length === 0)).toBe(true);
  });
});
