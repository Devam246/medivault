import { normalizeQuery } from "../../../src/utils/normalizeQuery.js";

describe("normalizeQuery", () => {
  test("trims leading and trailing whitespace", () => {
    expect(normalizeQuery("  hello world  ")).toBe("hello world");
  });

  test("lowercases the string", () => {
    expect(normalizeQuery("Hello World")).toBe("hello world");
  });

  test("strips trailing question marks, periods, and exclamation marks", () => {
    expect(normalizeQuery("What is my blood group?")).toBe("what is my blood group");
    expect(normalizeQuery("Help me.")).toBe("help me");
    expect(normalizeQuery("Warning!")).toBe("warning");
    expect(normalizeQuery("multiple punctuation!?...")).toBe("multiple punctuation");
  });

  test("handles empty or falsy inputs gracefully", () => {
    expect(normalizeQuery("")).toBe("");
    expect(normalizeQuery(null)).toBe("");
    expect(normalizeQuery(undefined)).toBe("");
  });
});
