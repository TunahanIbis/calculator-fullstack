import { describe, expect, it } from "vitest";

import { getOperation } from "./operations";
import { parseOperand, validateInputs } from "./validation";

describe("parseOperand", () => {
  it.each([
    ["42", 42],
    ["  7 ", 7],
    ["-3.5", -3.5],
    ["0", 0],
    ["1.5e3", 1500],
    [".25", 0.25],
  ])("accepts %j as %d", (raw, expected) => {
    const parsed = parseOperand(raw);
    expect(parsed.ok).toBe(true);
    expect(parsed.value).toBe(expected);
  });

  it.each([
    ["", "Enter a number"],
    ["   ", "Enter a number"],
    ["abc", "Not a valid number"],
    ["12abc", "Not a valid number"],
    ["1,5", "Not a valid number"],
    ["Infinity", "Number is too large"],
    ["-Infinity", "Number is too large"],
    ["NaN", "Not a valid number"],
  ])("rejects %j with message %j", (raw, message) => {
    const parsed = parseOperand(raw);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toBe(message);
  });
});

describe("validateInputs", () => {
  it("validates both operands for a binary operation", () => {
    const result = validateInputs(getOperation("add"), "2", "3");
    expect(result).toEqual({ ok: true, a: 2, b: 3, errors: {} });
  });

  it("collects an error per invalid field", () => {
    const result = validateInputs(getOperation("divide"), "x", "");
    expect(result.ok).toBe(false);
    expect(result.errors.a).toBe("Not a valid number");
    expect(result.errors.b).toBe("Enter a number");
  });

  it("ignores operand b for a unary operation", () => {
    const result = validateInputs(getOperation("sqrt"), "16", "nonsense");
    expect(result.ok).toBe(true);
    expect(result.a).toBe(16);
    expect(result.b).toBeUndefined();
    expect(result.errors).toEqual({});
  });

  it("still fails a unary operation when operand a is invalid", () => {
    const result = validateInputs(getOperation("sqrt"), "", "");
    expect(result.ok).toBe(false);
    expect(result.errors.a).toBe("Enter a number");
    expect(result.errors.b).toBeUndefined();
  });
});
