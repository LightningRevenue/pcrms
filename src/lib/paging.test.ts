import { describe, expect, it } from "vitest";
import { parsePaging, DEFAULT_PAGE_SIZE } from "./paging";

describe("parsePaging", () => {
  it("defaults when absent", () => {
    expect(parsePaging(undefined, undefined)).toEqual({ page: 1, perPage: DEFAULT_PAGE_SIZE });
  });

  it("accepts the offered sizes only", () => {
    expect(parsePaging("2", "100")).toEqual({ page: 2, perPage: 100 });
    // An arbitrary ?size= would otherwise become an unbounded `take`.
    expect(parsePaging("1", "5000").perPage).toBe(DEFAULT_PAGE_SIZE);
  });

  it("never yields a negative skip", () => {
    for (const bad of ["0", "-3", "abc", ""]) {
      expect(parsePaging(bad, "25").page).toBe(1);
    }
  });
});
