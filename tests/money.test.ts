import { describe, expect, it } from "vitest";
import { allocate, formatPKR, formatPKRCompact, rupeesToPaisa } from "@/lib/money";

describe("money (integer paisa)", () => {
  it("formats paisa as PKR", () => {
    expect(formatPKR(125000)).toBe("Rs 1,250");
    expect(formatPKR(125050)).toBe("Rs 1,250.50");
    expect(formatPKR(-5000)).toBe("−Rs 50");
    expect(formatPKR(null)).toBe("—");
  });
  it("compacts lakh / crore", () => {
    expect(formatPKRCompact(15_000_000)).toBe("Rs 1.5 L");
    expect(formatPKRCompact(1_250_000_000)).toBe("Rs 1.25 Cr");
  });
  it("parses rupee input without float error", () => {
    expect(rupeesToPaisa("1,250.50")).toBe(125050);
    expect(rupeesToPaisa("0.1")).toBe(10);
    expect(rupeesToPaisa("Rs 99")).toBe(9900);
    expect(rupeesToPaisa("12.345")).toBeNull();
    expect(rupeesToPaisa("abc")).toBeNull();
  });
  it("allocates exactly (sum preserved)", () => {
    const parts = allocate(1000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
    expect(allocate(500, [0, 0])).toEqual([0, 500]);
  });
});
