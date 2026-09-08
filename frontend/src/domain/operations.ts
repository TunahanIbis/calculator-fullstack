/**
 * The operations exposed by the calculator API. This table mirrors the
 * backend's `/api/v1/operations` catalogue and is the single source of truth
 * for the UI: it drives the operation picker, the "does this need a second
 * operand?" logic, and the API path used for each call.
 */

export type OperationId =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "power"
  | "sqrt"
  | "percentage";

export interface Operation {
  id: OperationId;
  /** Short human label for the picker. */
  label: string;
  /** Compact symbol shown on the button. */
  symbol: string;
  /** 1 = unary (operand `a` only), 2 = binary (`a` and `b`). */
  arity: 1 | 2;
  /** Screen-reader / tooltip description of what the operation does. */
  hint: string;
}

export const OPERATIONS: readonly Operation[] = [
  { id: "add", label: "Add", symbol: "+", arity: 2, hint: "a plus b" },
  { id: "subtract", label: "Subtract", symbol: "−", arity: 2, hint: "a minus b" },
  { id: "multiply", label: "Multiply", symbol: "×", arity: 2, hint: "a times b" },
  { id: "divide", label: "Divide", symbol: "÷", arity: 2, hint: "a divided by b" },
  { id: "power", label: "Power", symbol: "xʸ", arity: 2, hint: "a to the power of b" },
  { id: "sqrt", label: "Square root", symbol: "√", arity: 1, hint: "square root of a" },
  { id: "percentage", label: "Percentage", symbol: "%", arity: 2, hint: "a percent of b" },
] as const;

const OPERATIONS_BY_ID: Record<OperationId, Operation> = Object.fromEntries(
  OPERATIONS.map((op) => [op.id, op]),
) as Record<OperationId, Operation>;

export function getOperation(id: OperationId): Operation {
  return OPERATIONS_BY_ID[id];
}

/** Renders `a op b` (or `√a`) for display in history and result labels. */
export function formatExpression(
  op: Operation,
  a: number,
  b: number | undefined,
): string {
  if (op.arity === 1) {
    return `${op.symbol}${a}`;
  }
  if (op.id === "percentage") {
    return `${a}${op.symbol} of ${b}`;
  }
  return `${a} ${op.symbol} ${b}`;
}
