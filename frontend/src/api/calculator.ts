/**
 * Typed wrappers around the calculator service's operation endpoints.
 */

import type { RequestOpId } from "../domain/calculatorMachine";
import { ApiError, postJson } from "./client";

/** Identifier accepted by the operation endpoints (`add` … `sqrt`). */
export type OperationId = RequestOpId;

/** Success envelope returned by every operation endpoint. */
export interface CalculationResult {
  operation: OperationId;
  a: number;
  b?: number;
  result: number;
}

/**
 * User-facing messages for the error `code`s the backend (and client) can
 * produce. Falls back to the server's own message, then a generic line.
 */
const FRIENDLY_MESSAGE: Record<string, string> = {
  DIVISION_BY_ZERO: "Can't divide by zero.",
  NEGATIVE_SQRT: "No square root of a negative.",
  NON_FINITE_NUMBER: "Result is out of range.",
  VALIDATION_ERROR: "Check the values you entered.",
  INVALID_JSON: "Check the values you entered.",
  NETWORK: "Can't reach the calculator service.",
};

const GENERIC_MESSAGE = "Something went wrong.";

export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    return FRIENDLY_MESSAGE[error.code] ?? error.message ?? GENERIC_MESSAGE;
  }
  return GENERIC_MESSAGE;
}

/**
 * Calls the endpoint for `operation`. Pass `b` for binary operations; omit it
 * for unary ones (`sqrt`). Resolves with the result or throws `ApiError`.
 */
export function calculate(
  operation: OperationId,
  a: number,
  b?: number,
): Promise<CalculationResult> {
  const body = b === undefined ? { a } : { a, b };
  return postJson<CalculationResult>(`/api/v1/${operation}`, body);
}
