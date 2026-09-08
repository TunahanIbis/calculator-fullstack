/**
 * Client-side input validation.
 *
 * The backend is the source of truth for arithmetic rules (division by zero,
 * negative square roots, overflow). The client's job is narrower: make sure we
 * only ever send well-formed, finite numbers, and give the user immediate
 * feedback on typos before a request is made.
 */

import type { Operation } from "./operations";

export interface ParsedOperand {
  ok: boolean;
  value: number;
  /** Present when `ok` is false. */
  error?: string;
}

/**
 * Parses a raw text field into a finite number. Accepts optional surrounding
 * whitespace, a leading sign, decimals and scientific notation (`1.5e3`).
 * Rejects empty input, non-numeric text, and non-finite values (`Infinity`,
 * `NaN`).
 */
export function parseOperand(raw: string): ParsedOperand {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, value: NaN, error: "Enter a number" };
  }

  // Number() is deliberately stricter than parseFloat: "12abc" -> NaN rather
  // than 12, and it understands scientific notation.
  const value = Number(trimmed);
  if (Number.isNaN(value)) {
    return { ok: false, value: NaN, error: "Not a valid number" };
  }
  if (!Number.isFinite(value)) {
    return { ok: false, value: NaN, error: "Number is too large" };
  }

  return { ok: true, value };
}

export interface InputErrors {
  a?: string;
  b?: string;
}

export interface ValidationResult {
  ok: boolean;
  a: number;
  /** `undefined` for unary operations. */
  b: number | undefined;
  errors: InputErrors;
}

/**
 * Validates the operand fields for a given operation. `b` is ignored (and not
 * required) when the operation is unary.
 */
export function validateInputs(
  operation: Operation,
  rawA: string,
  rawB: string,
): ValidationResult {
  const parsedA = parseOperand(rawA);
  const errors: InputErrors = {};
  if (!parsedA.ok) {
    errors.a = parsedA.error;
  }

  if (operation.arity === 1) {
    return {
      ok: parsedA.ok,
      a: parsedA.value,
      b: undefined,
      errors,
    };
  }

  const parsedB = parseOperand(rawB);
  if (!parsedB.ok) {
    errors.b = parsedB.error;
  }

  return {
    ok: parsedA.ok && parsedB.ok,
    a: parsedA.value,
    b: parsedB.value,
    errors,
  };
}
