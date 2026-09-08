import { describe, expect, it } from "vitest";

import {
  INITIAL_STATE,
  displayValue,
  expressionText,
  reducer,
  type BinaryOpId,
  type MachineAction,
  type MachineState,
} from "./calculatorMachine";

// ---- action constructors ------------------------------------------------

const d = (v: string): MachineAction => ({ type: "digit", value: v });
const digits = (s: string): MachineAction[] => [...s].map(d);
const op = (o: BinaryOpId): MachineAction => ({ type: "operator", op: o });
const dot: MachineAction = { type: "decimal" };
const eq: MachineAction = { type: "equals" };
const sqrt: MachineAction = { type: "unary", op: "sqrt" };
const bs: MachineAction = { type: "backspace" };
const clr: MachineAction = { type: "clear" };
const neg: MachineAction = { type: "negate" };
const resolve = (n: number): MachineAction => ({ type: "resolve", result: n });
const reject = (m: string): MachineAction => ({ type: "reject", message: m });

function fold(...actions: MachineAction[]): MachineState {
  return actions.flat().reduce(reducer, INITIAL_STATE);
}

// ---- entry building ---------------------------------------------------

describe("entry building", () => {
  it("accumulates digits", () => {
    expect(displayValue(fold(...digits("78")))).toBe("78");
  });

  it("replaces a leading zero", () => {
    expect(displayValue(fold(d("0"), d("5")))).toBe("5");
  });

  it("allows only one decimal point", () => {
    expect(displayValue(fold(d("1"), dot, d("5"), dot, d("2")))).toBe("1.52");
  });

  it("starts a decimal with '0.'", () => {
    expect(displayValue(fold(dot, d("5")))).toBe("0.5");
  });

  it("backspaces a digit at a time, then shows 0", () => {
    expect(displayValue(fold(...digits("123"), bs))).toBe("12");
    expect(displayValue(fold(...digits("1"), bs))).toBe("0");
  });

  it("clear resets everything", () => {
    expect(fold(...digits("42"), op("add"), d("9"), clr)).toEqual(INITIAL_STATE);
  });

  it("caps entry length", () => {
    const long = fold(...digits("12345678901234567890"));
    expect(displayValue(long).length).toBeLessThanOrEqual(16);
  });

  it("starts a fresh decimal after an operator or after '='", () => {
    expect(displayValue(fold(d("5"), op("add"), dot))).toBe("0.");
    const evaluated = reducer(fold(d("2"), op("add"), d("3"), eq), resolve(5));
    expect(displayValue(reducer(evaluated, dot))).toBe("0.");
  });

  it("ignores backspace right after a result and clears on backspace after an error", () => {
    const evaluated = reducer(fold(d("2"), op("add"), d("3"), eq), resolve(5));
    expect(reducer(evaluated, bs)).toBe(evaluated); // no-op
    const errored = reducer(fold(d("1"), op("divide"), d("0"), eq), reject("nope"));
    expect(reducer(errored, bs)).toEqual(INITIAL_STATE);
  });

  it("ignores operator, unary and equals while an error is showing", () => {
    const errored = reducer(fold(d("1"), op("divide"), d("0"), eq), reject("nope"));
    expect(reducer(errored, op("add"))).toBe(errored);
    expect(reducer(errored, sqrt)).toBe(errored);
    expect(reducer(errored, eq)).toBe(errored);
  });

  it("keeps showing the frozen expression after '='", () => {
    const done = reducer(fold(d("9"), op("multiply"), d("2"), eq), resolve(18));
    expect(expressionText(done)).toBe("9 × 2 =");
    // A digit afterwards starts fresh and the frozen line clears.
    expect(expressionText(reducer(done, d("4")))).toBe("");
  });

  it("drops a queued operator if the folded step is rejected", () => {
    let s = fold(d("8"), op("divide"), d("0"), op("add")); // 8 ÷ 0, then queue +
    expect(s.queuedOp).toBe("add");
    s = reducer(s, reject("nope"));
    expect(s.queuedOp).toBeNull();
    expect(s.error).toBe("nope");
  });
});

// ---- binary operations --------------------------------------------------

describe("binary operations", () => {
  it("requests a calculation on '=' and shows the resolved result", () => {
    const requested = fold(d("7"), op("subtract"), d("6"), eq);
    expect(requested.request).toEqual({ op: "subtract", a: 7, b: 6 });

    const done = reducer(requested, resolve(1));
    expect(displayValue(done)).toBe("1");
    expect(expressionText(done)).toBe("7 − 6 =");
  });

  it("shows the running expression while an operator is pending", () => {
    const s = fold(d("7"), op("add"));
    expect(displayValue(s)).toBe("7");
    expect(expressionText(s)).toBe("7 +");
  });

  it("chains left to right with no precedence", () => {
    // 7 + 6 × 2  ->  (7 + 6) × 2  ->  26
    let s = fold(d("7"), op("add"), d("6"), op("multiply"));
    expect(s.request).toEqual({ op: "add", a: 7, b: 6 });
    expect(s.queuedOp).toBe("multiply");

    s = reducer(s, resolve(13));
    expect(displayValue(s)).toBe("13");
    expect(expressionText(s)).toBe("13 ×");

    s = [d("2"), eq].reduce(reducer, s);
    expect(s.request).toEqual({ op: "multiply", a: 13, b: 2 });
    expect(displayValue(reducer(s, resolve(26)))).toBe("26");
  });

  it("swaps a pending operator without calculating", () => {
    const s = fold(d("7"), op("add"), op("subtract"));
    expect(s.request).toBeNull();
    expect(s.pendingOp).toBe("subtract");
    expect(fold(d("7"), op("add"), op("subtract"), d("3"), eq).request).toEqual({
      op: "subtract",
      a: 7,
      b: 3,
    });
  });

  it("uses the accumulator as the operand for 'a op ='", () => {
    expect(fold(d("7"), op("add"), eq).request).toEqual({ op: "add", a: 7, b: 7 });
  });

  it("does nothing on '=' with no operation pending", () => {
    expect(fold(d("7"), eq).request).toBeNull();
    expect(fold(eq)).toEqual(INITIAL_STATE);
  });

  it("repeats the last operation on a second '='", () => {
    let s = reducer(fold(d("7"), op("add"), d("6"), eq), resolve(13));
    s = reducer(s, eq);
    expect(s.request).toEqual({ op: "add", a: 13, b: 6 });
    expect(displayValue(reducer(s, resolve(19)))).toBe("19");
  });

  it("continues a new chain from a result", () => {
    let s = reducer(fold(d("7"), op("add"), d("6"), eq), resolve(13));
    s = reducer(s, op("multiply"));
    expect(s.accumulator).toBe(13);
    expect(expressionText(s)).toBe("13 ×");
  });

  it("starts fresh when a digit follows '='", () => {
    let s = reducer(fold(d("7"), op("add"), d("6"), eq), resolve(13));
    s = reducer(s, d("9"));
    expect(displayValue(s)).toBe("9");
    expect(s.accumulator).toBeNull();
  });
});

// ---- unary (sqrt) -----------------------------------------------------

describe("square root", () => {
  it("requests sqrt of the current value and shows the result", () => {
    const requested = fold(...digits("9"), sqrt);
    expect(requested.request).toEqual({ op: "sqrt", a: 9 });

    const done = reducer(requested, resolve(3));
    expect(displayValue(done)).toBe("3");
    expect(expressionText(done)).toBe("√9 =");
  });

  it("applies to the entry mid-chain and leaves the pending operator", () => {
    let s = fold(d("7"), op("add"), d("9"), sqrt);
    expect(s.request).toEqual({ op: "sqrt", a: 9 });
    s = reducer(s, resolve(3));
    expect(s.pendingOp).toBe("add");
    expect(s.accumulator).toBe(7);

    s = reducer(s, eq);
    expect(s.request).toEqual({ op: "add", a: 7, b: 3 });
    expect(displayValue(reducer(s, resolve(10)))).toBe("10");
  });
});

// ---- negate ---------------------------------------------------------

describe("negate", () => {
  it("toggles the sign of the entry", () => {
    expect(displayValue(fold(d("5"), neg))).toBe("-5");
    expect(displayValue(fold(d("5"), neg, neg))).toBe("5");
  });

  it("toggles the sign of the accumulator when there is no entry", () => {
    const s = fold(d("5"), op("add"), neg);
    expect(s.accumulator).toBe(-5);
  });

  it("does nothing when there is nothing to negate", () => {
    expect(fold(neg)).toEqual(INITIAL_STATE);
  });
});

// ---- errors -------------------------------------------------------------

describe("errors", () => {
  it("stores a rejection and recovers on the next digit", () => {
    let s = fold(d("8"), op("divide"), d("0"), eq);
    expect(s.request).toEqual({ op: "divide", a: 8, b: 0 });

    s = reducer(s, reject("You can't divide by zero."));
    expect(s.error).toBe("You can't divide by zero.");
    expect(s.request).toBeNull();

    s = reducer(s, d("5"));
    expect(s.error).toBeNull();
    expect(displayValue(s)).toBe("5");
  });

  it("clears the error on Clear", () => {
    const s = reducer(fold(d("1"), op("divide"), d("0"), eq), reject("boom"));
    expect(reducer(s, clr)).toEqual(INITIAL_STATE);
  });
});
