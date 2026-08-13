import { describe, expect, it } from "vitest";
import { createScanGate } from "./scanDedupe";
describe("scan gate", () => {
  it("blocks repeated scans during cooldown", () => {
    const gate = createScanGate(2500);
    expect(gate("123", 1000)).toBe(true);
    expect(gate("123", 2000)).toBe(false);
    expect(gate("123", 4000)).toBe(true);
  });
  it("allows another barcode immediately", () => {
    const gate = createScanGate();
    expect(gate("123", 1000)).toBe(true);
    expect(gate("456", 1100)).toBe(true);
  });
});
