import { describe, expect, it } from "vitest";

import { formatNumber } from "./format";

describe("formatNumber", () => {
  it("shows integers verbatim", () => {
    expect(formatNumber(1024)).toBe("1024");
    expect(formatNumber(-7)).toBe("-7");
    expect(formatNumber(0)).toBe("0");
  });

  it("removes floating-point noise", () => {
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
    expect(formatNumber(22 / 7)).toBe("3.142857143");
  });

  it("keeps genuine decimals", () => {
    expect(formatNumber(3.5)).toBe("3.5");
    expect(formatNumber(-0.125)).toBe("-0.125");
  });

  it("falls back to compact exponential when a value would be too long", () => {
    expect(formatNumber(85 / 8555555)).toBe("9.93507e-6");
    expect(formatNumber(1e21)).toBe("1e21");
    expect(formatNumber(-1.23456789e-9)).toBe("-1.23457e-9");
    // Every formatted value stays short enough for one display line.
    for (const v of [85 / 8555555, 1e30, 2 ** 53, Math.PI / 1e8, -7 / 3]) {
      expect(formatNumber(v).length).toBeLessThanOrEqual(14);
    }
  });

  it("passes non-finite values straight through", () => {
    expect(formatNumber(Infinity)).toBe("Infinity");
    expect(formatNumber(NaN)).toBe("NaN");
  });
});
