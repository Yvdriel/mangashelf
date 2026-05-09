import { describe, expect, it } from "vitest";
import { expandTags } from "./tag-template";

describe("expandTags", () => {
  const ctx = {
    series: "One Piece",
    volume: 3,
    page: 47,
    date: new Date("2026-05-09T10:00:00Z"),
  };

  it("substitutes {series}, {volume}, {page}", () => {
    expect(expandTags(["{series}", "vol{volume}", "p{page}"], ctx)).toEqual([
      "One_Piece",
      "vol3",
      "p47",
    ]);
  });

  it("substitutes {date} as ISO yyyy-mm-dd", () => {
    expect(expandTags(["{date}"], ctx)).toEqual(["2026-05-09"]);
  });

  it("replaces multiple variables in a single tag", () => {
    expect(expandTags(["{series}-vol{volume}-p{page}"], ctx)).toEqual([
      "One_Piece-vol3-p47",
    ]);
  });

  it("collapses whitespace inside substituted series names so tags don't split", () => {
    expect(expandTags(["{series}"], { ...ctx, series: "Demon  Slayer" })).toEqual([
      "Demon_Slayer",
    ]);
  });

  it("leaves unknown {placeholders} untouched", () => {
    expect(expandTags(["{nope}"], ctx)).toEqual(["{nope}"]);
  });

  it("filters out empty tags", () => {
    expect(expandTags(["", "  ", "real"], ctx)).toEqual(["real"]);
  });

  it("falls back to today when ctx.date is omitted", () => {
    const out = expandTags(["{date}"], { series: "X", volume: 1, page: 1 });
    expect(out[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
