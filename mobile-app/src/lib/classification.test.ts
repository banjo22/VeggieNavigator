import { describe, expect, it } from "vitest";
import {
  mapStatus,
  normalizeProduct,
  personalizeStatus,
} from "./classification";
describe("profile classification", () => {
  it("marks vegetarian products unsuitable for vegan goals", () =>
    expect(personalizeStatus("vegetarian", "vegan")).toBe("not_suitable"));
  it("keeps vegetarian status for vegetarian goals", () =>
    expect(personalizeStatus("vegetarian", "vegetarian")).toBe("vegetarian"));
  it("maps unknown API values safely", () =>
    expect(mapStatus("maybe")).toBe("unclear"));
  it("normalizes malformed product data", () =>
    expect(
      normalizeProduct({ product: { name: "Test", confidence: 0.9 } }, "vegan"),
    ).toMatchObject({ name: "Test", status: "unclear", confidence: "high" }));
});
