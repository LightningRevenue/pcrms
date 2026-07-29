import { describe, expect, it } from "vitest";
import { caenToIndustry } from "./caen";
import { INDUSTRIES } from "./firmographics";

describe("caenToIndustry", () => {
  it("maps a code with its Romanian label, dropping the label", () => {
    expect(caenToIndustry("7911 - Activitati ale agentiilor turistice")).toBe("Leisure & Travel");
  });

  it("maps a bare code", () => {
    expect(caenToIndustry("6201")).toBe("Computer Software");
  });

  it("prefers the longest matching prefix", () => {
    // Division 69 is legal + accounting; the 4-digit entries must win over it.
    expect(caenToIndustry("6910 - Activitati juridice")).toBe("Legal Services");
    expect(caenToIndustry("6920 - Activitati de contabilitate")).toBe("Accounting");
    // No 4-digit entry for 6202, so it falls back to division 62.
    expect(caenToIndustry("6202")).toBe("Information Technology & Services");
  });

  it("leaves non-CAEN industries untouched", () => {
    expect(caenToIndustry("Manufacturing")).toBe("Manufacturing");
    expect(caenToIndustry("Aerospace & Defense")).toBe("Aerospace & Defense");
  });

  it("only matches a code at the start, and only 4 digits", () => {
    expect(caenToIndustry("Top 7911 agencies")).toBe("Top 7911 agencies");
    expect(caenToIndustry("79 - Agentii")).toBe("79 - Agentii");
    expect(caenToIndustry("79110 - something")).toBe("79110 - something");
  });

  it("keeps the original text when the division isn't mapped", () => {
    // 04 isn't a CAEN division and isn't in the table.
    expect(caenToIndustry("0400 - necunoscut")).toBe("0400 - necunoscut");
  });

  it("passes empty values through unchanged", () => {
    expect(caenToIndustry(null)).toBe(null);
    expect(caenToIndustry(undefined)).toBe(undefined);
    expect(caenToIndustry("")).toBe("");
  });

  it("only ever emits values the picker offers", () => {
    for (const code of ["7911", "6910", "4120", "4711", "5610", "8610", "2611"]) {
      expect(INDUSTRIES).toContain(caenToIndustry(code));
    }
  });
});
