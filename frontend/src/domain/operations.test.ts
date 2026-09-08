import { describe, expect, it } from "vitest";

import {
  OPERATIONS,
  formatExpression,
  getOperation,
} from "./operations";

describe("operations catalogue", () => {
  it("exposes the seven API operations", () => {
    expect(OPERATIONS.map((o) => o.id)).toEqual([
      "add",
      "subtract",
      "multiply",
      "divide",
      "power",
      "sqrt",
      "percentage",
    ]);
  });

  it("marks only sqrt as unary", () => {
    for (const op of OPERATIONS) {
      expect(op.arity).toBe(op.id === "sqrt" ? 1 : 2);
    }
  });

  it("getOperation returns the matching entry", () => {
    expect(getOperation("divide").label).toBe("Divide");
  });
});

describe("formatExpression", () => {
  it("formats a binary operation as 'a symbol b'", () => {
    expect(formatExpression(getOperation("multiply"), 6, 7)).toBe("6 × 7");
  });

  it("formats sqrt as a prefix", () => {
    expect(formatExpression(getOperation("sqrt"), 81, undefined)).toBe("√81");
  });

  it("formats percentage in words", () => {
    expect(formatExpression(getOperation("percentage"), 15, 200)).toBe(
      "15% of 200",
    );
  });
});
