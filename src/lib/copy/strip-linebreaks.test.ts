import { describe, expect, it } from "vitest";
import { stripLinebreaks } from "./strip-linebreaks";

describe("stripLinebreaks", () => {
  it("removes \\n", () => {
    expect(stripLinebreaks("そのダンボール\nゴミに出す分ですか")).toBe(
      "そのダンボールゴミに出す分ですか",
    );
  });

  it("removes \\r\\n", () => {
    expect(stripLinebreaks("a\r\nb\r\nc")).toBe("abc");
  });

  it("removes lone \\r", () => {
    expect(stripLinebreaks("a\rb\rc")).toBe("abc");
  });

  it("removes mixed line endings", () => {
    expect(stripLinebreaks("a\nb\r\nc\rd\n\re")).toBe("abcde");
  });

  it("preserves the ideographic space (U+3000)", () => {
    expect(stripLinebreaks("綾瀬\n　申します")).toBe("綾瀬　申します");
  });

  it("preserves regular ASCII spaces", () => {
    expect(stripLinebreaks("hello world\nfoo bar")).toBe(
      "hello worldfoo bar",
    );
  });

  it("preserves tabs", () => {
    expect(stripLinebreaks("a\tb\nc\td")).toBe("a\tbc\td");
  });

  it("returns empty string unchanged", () => {
    expect(stripLinebreaks("")).toBe("");
  });

  it("returns string with no linebreaks unchanged", () => {
    expect(stripLinebreaks("私となりに住んでおります")).toBe(
      "私となりに住んでおります",
    );
  });
});
