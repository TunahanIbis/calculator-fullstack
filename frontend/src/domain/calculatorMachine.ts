/**
 * A pure state machine for a basic pocket calculator.
 *
 * It owns all keypad/keyboard UX logic (building an entry, chaining operators
 * left to right, repeat-equals, clear/backspace) but performs **no arithmetic**
 * itself. When a calculation is due it records it in `state.request`; the host
 * runs it against the API and feeds the answer back with a `resolve` action (or
 * a `reject` on failure). This keeps the machine trivially unit-testable and
 * keeps every sum on the backend.
 *
 * Chaining is left to right with no operator precedence, exactly like a
 * four-function calculator: `2 + 3 × 4 =` is `20`, not `14`.
 */

import { formatNumber } from "./format";

export type BinaryOpId =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "power"
  | "percentage";

export type RequestOpId = BinaryOpId | "sqrt";

/** Button/keyboard symbol for each operator. */
export const OP_SYMBOL: Record<RequestOpId, string> = {
  add: "+",
  subtract: "−", // minus sign
  multiply: "×", // times sign
  divide: "÷", // division sign
  power: "^",
  percentage: "%",
  sqrt: "√",
};

/** A calculation the host must run: `sqrt` omits `b`. */
export interface CalcRequest {
  op: RequestOpId;
  a: number;
  b?: number;
}

export interface MachineState {
  /** Digits currently being typed. "" means "show the accumulator or 0". */
  entry: string;
  /** Left-hand value carried between steps. */
  accumulator: number | null;
  /** Operator waiting for its right-hand operand. */
  pendingOp: BinaryOpId | null;
  /** Operator pressed while a chained calculation is still resolving. */
  queuedOp: BinaryOpId | null;
  /** Next digit starts a fresh entry (set after an operator). */
  overwrite: boolean;
  /** The previous action was `=` (or a unary result). */
  justEvaluated: boolean;
  /** Operator + operand of the last `=`, for repeat-equals. */
  lastOp: BinaryOpId | null;
  lastOperand: number | null;
  /** Calculation the host must execute; cleared by `resolve`/`reject`. */
  request: CalcRequest | null;
  /** Frozen text shown on the expression line right after `=`. */
  lastExpression: string | null;
  /** User-facing error from a rejected calculation. */
  error: string | null;
}

export type MachineAction =
  | { type: "digit"; value: string }
  | { type: "decimal" }
  | { type: "operator"; op: BinaryOpId }
  | { type: "unary"; op: "sqrt" }
  | { type: "negate" }
  | { type: "equals" }
  | { type: "backspace" }
  | { type: "clear" }
  | { type: "resolve"; result: number }
  | { type: "reject"; message: string };

export const INITIAL_STATE: MachineState = {
  entry: "",
  accumulator: null,
  pendingOp: null,
  queuedOp: null,
  overwrite: false,
  justEvaluated: false,
  lastOp: null,
  lastOperand: null,
  request: null,
  lastExpression: null,
  error: null,
};

const MAX_ENTRY_LENGTH = 16;

/** The number the display is currently showing. */
function currentValue(state: MachineState): number {
  if (state.entry !== "" && state.entry !== "-") {
    return Number(state.entry);
  }
  return state.accumulator ?? 0;
}

export function reducer(state: MachineState, action: MachineAction): MachineState {
  switch (action.type) {
    case "clear":
      return INITIAL_STATE;

    case "digit": {
      // A digit after an error or after "=" begins a brand-new calculation.
      if (state.error || state.justEvaluated) {
        return { ...INITIAL_STATE, entry: action.value };
      }
      // A digit after an operator starts a fresh operand, keeping the chain.
      if (state.overwrite) {
        return { ...state, entry: action.value, overwrite: false };
      }
      if (state.entry.replace("-", "").length >= MAX_ENTRY_LENGTH) return state;
      const next = state.entry === "0" ? action.value : state.entry + action.value;
      return { ...state, entry: next };
    }

    case "decimal": {
      if (state.error || state.justEvaluated) {
        return { ...INITIAL_STATE, entry: "0." };
      }
      if (state.overwrite) {
        return { ...state, entry: "0.", overwrite: false };
      }
      if (state.entry.includes(".")) return state;
      return { ...state, entry: (state.entry === "" ? "0" : state.entry) + "." };
    }

    case "negate": {
      if (state.error) return state;
      if (state.entry !== "" && state.entry !== "-") {
        return {
          ...state,
          entry: state.entry.startsWith("-")
            ? state.entry.slice(1)
            : "-" + state.entry,
        };
      }
      if (state.accumulator != null) {
        return { ...state, accumulator: -state.accumulator };
      }
      return state;
    }

    case "backspace": {
      if (state.error) return INITIAL_STATE;
      if (state.overwrite || state.justEvaluated) return state;
      if (state.entry === "") return state;
      const trimmed = state.entry.slice(0, -1);
      return { ...state, entry: trimmed === "-" ? "" : trimmed };
    }

    case "operator": {
      if (state.error) return state;
      const hasFreshOperand = state.entry !== "" && !state.overwrite;

      // A calculation is due: fold the pending step, queue the new operator.
      if (state.pendingOp != null && hasFreshOperand) {
        return {
          ...state,
          request: {
            op: state.pendingOp,
            a: state.accumulator ?? 0,
            b: Number(state.entry),
          },
          queuedOp: action.op,
          justEvaluated: false,
          lastExpression: null,
        };
      }
      // Just swapping the pending operator.
      if (state.pendingOp != null) {
        return { ...state, pendingOp: action.op, justEvaluated: false };
      }
      // Start a chain from the shown value.
      return {
        ...state,
        accumulator: currentValue(state),
        pendingOp: action.op,
        entry: "",
        overwrite: true,
        justEvaluated: false,
        lastExpression: null,
      };
    }

    case "unary": {
      if (state.error) return state;
      return { ...state, request: { op: "sqrt", a: currentValue(state) } };
    }

    case "equals": {
      if (state.error) return state;

      if (state.pendingOp != null) {
        const b = state.entry !== "" ? Number(state.entry) : (state.accumulator ?? 0);
        return {
          ...state,
          request: { op: state.pendingOp, a: state.accumulator ?? 0, b },
        };
      }
      // Repeat-equals: reapply the last operator to the running total.
      if (state.lastOp != null && state.lastOperand != null && state.accumulator != null) {
        return {
          ...state,
          request: { op: state.lastOp, a: state.accumulator, b: state.lastOperand },
        };
      }
      return state;
    }

    case "resolve": {
      const req = state.request;
      if (!req) return state;

      // Unary (sqrt): the answer replaces the entry; any pending "+" survives.
      if (req.op === "sqrt") {
        const hasPending = state.pendingOp != null;
        return {
          ...state,
          request: null,
          entry: String(action.result),
          overwrite: true,
          justEvaluated: !hasPending,
          accumulator: hasPending ? state.accumulator : action.result,
          lastExpression: hasPending
            ? state.lastExpression
            : `${OP_SYMBOL.sqrt}${formatNumber(req.a)} =`,
          error: null,
        };
      }

      // Chained step: adopt the result and apply the queued operator.
      if (state.queuedOp != null) {
        return {
          ...state,
          request: null,
          queuedOp: null,
          accumulator: action.result,
          pendingOp: state.queuedOp,
          entry: "",
          overwrite: true,
          justEvaluated: false,
          lastExpression: null,
          error: null,
        };
      }

      // Terminal "=" (always a binary op here; sqrt is handled above).
      return {
        ...state,
        request: null,
        accumulator: action.result,
        pendingOp: null,
        entry: "",
        overwrite: true,
        justEvaluated: true,
        lastOp: req.op,
        lastOperand: req.b as number,
        lastExpression: `${formatNumber(req.a)} ${OP_SYMBOL[req.op]} ${formatNumber(
          req.b as number,
        )} =`,
        error: null,
      };
    }

    case "reject":
      return {
        ...state,
        request: null,
        queuedOp: null,
        error: action.message,
      };

    /* v8 ignore next 4 -- exhaustive: TypeScript guarantees every action is handled */
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// ---- selectors ----------------------------------------------------------

/** Big line: the number (or partial number) the calculator is showing. */
export function displayValue(state: MachineState): string {
  // While typing, echo exactly what was entered (keeps a trailing "." or "0").
  if (state.entry !== "") return state.entry;
  return state.accumulator != null ? formatNumber(state.accumulator) : "0";
}

/** Small line: the expression being built, or the frozen post-`=` text. */
export function expressionText(state: MachineState): string {
  if (state.justEvaluated && state.lastExpression) return state.lastExpression;
  if (state.accumulator == null || state.pendingOp == null) return "";
  const left = formatNumber(state.accumulator);
  const symbol = OP_SYMBOL[state.pendingOp];
  const right = state.entry !== "" && !state.overwrite ? ` ${state.entry}` : "";
  return `${left} ${symbol}${right}`;
}
