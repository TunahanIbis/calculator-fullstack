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
    expect(formatNumber(22 / 7)).toBe("3.14285714286");
  });

  it("keeps genuine decimals", () => {
    expect(formatNumber(3.5)).toBe("3.5");
    expect(formatNumber(-0.125)).toBe("-0.125");
  });

  it("passes non-finite values straight through", () => {
    expect(formatNumber(Infinity)).toBe("Infinity");
    expect(formatNumber(NaN)).toBe("NaN");
  });
});
