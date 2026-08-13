import { describe, expect, it } from "vitest";
import { countries } from "./countries";
import { getTravelQuestions, ingredients, travelGuides } from "./knowledge";

describe("offline knowledge data", () => {
  it("contains a complete country selector without duplicate codes", () => {
    expect(countries.length).toBeGreaterThanOrEqual(190);
    expect(new Set(countries.map((country) => country.code)).size).toBe(
      countries.length,
    );
  });

  it("provides searchable aliases and detailed travel guides", () => {
    expect(ingredients.some((item) => item.aliases.includes("E120"))).toBe(
      true,
    );
    expect(travelGuides.length).toBeGreaterThanOrEqual(15);
    expect(getTravelQuestions("IT")).toHaveLength(6);
    expect(getTravelQuestions("IT")[2]?.local).toContain("parmigiano");
  });
});
