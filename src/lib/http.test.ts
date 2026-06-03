import { describe, expect, it } from "vitest";
import { ifNoneMatchSatisfied, quoteETag } from "./http";

describe("quoteETag", () => {
  it("quotes a bare token and is idempotent", () => {
    expect(quoteETag("abc")).toBe('"abc"');
    expect(quoteETag('"abc"')).toBe('"abc"');
  });
});

describe("ifNoneMatchSatisfied", () => {
  const etag = '"vol-1-3-99"';

  it("returns false for a missing header", () => {
    expect(ifNoneMatchSatisfied(null, etag)).toBe(false);
  });

  it("matches the exact quoted value", () => {
    expect(ifNoneMatchSatisfied('"vol-1-3-99"', etag)).toBe(true);
  });

  it("matches within a comma-separated list", () => {
    expect(ifNoneMatchSatisfied('"x", "vol-1-3-99", "y"', etag)).toBe(true);
  });

  it("matches ignoring weak-validator framing", () => {
    expect(ifNoneMatchSatisfied('W/"vol-1-3-99"', etag)).toBe(true);
  });

  it("matches a bare (unquoted) echo against a quoted etag", () => {
    expect(ifNoneMatchSatisfied("vol-1-3-99", etag)).toBe(true);
  });

  it("matches the wildcard", () => {
    expect(ifNoneMatchSatisfied("*", etag)).toBe(true);
  });

  it("returns false for a non-match", () => {
    expect(ifNoneMatchSatisfied('"vol-1-4-99"', etag)).toBe(false);
  });
});
