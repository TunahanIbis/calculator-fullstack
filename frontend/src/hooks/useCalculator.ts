import { useCallback, useEffect, useRef, useState } from "react";

import { calculate, friendlyError } from "../api/calculator";
import {
  INITIAL_STATE,
  OP_SYMBOL,
  displayValue,
  expressionText,
  reducer,
  type MachineAction,
  type MachineState,
} from "../domain/calculatorMachine";
import { formatNumber } from "../domain/format";

export type Status = "idle" | "loading" | "error";

export interface HistoryEntry {
  id: number;
  expression: string;
  result: number;
}

const HISTORY_LIMIT = 50;

export interface CalculatorView {
  /** Big line: current number or result. */
  value: string;
  /** Small line: the expression being built, or "". */
  expression: string;
  /** Present when the last calculation failed. */
  error: string | null;
  status: Status;
  busy: boolean;
  history: HistoryEntry[];
  /** Send a keypad/keyboard action into the calculator. */
  dispatch: (action: MachineAction) => void;
  clearHistory: () => void;
}

/**
 * Wraps the pure calculator machine. The machine state lives in a ref so it is
 * always synchronously current; a bump counter drives re-renders.
 *
 * When the machine records a `request`, an effect runs it against the API and
 * feeds the answer back. Actions that arrive while a request is in flight are
 * buffered and replayed once it settles, so fast typing such as `25×18+40=`
 * never loses a keystroke.
 */
export function useCalculator(): CalculatorView {
  const stateRef = useRef<MachineState>(INITIAL_STATE);
  const bufferRef = useRef<MachineAction[]>([]);
  const [, setTick] = useState(0);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const nextId = useRef(1);

  const apply = useCallback((action: MachineAction) => {
    stateRef.current = reducer(stateRef.current, action);
    setTick((t) => t + 1);
  }, []);

  const flushBuffer = useCallback(() => {
    while (bufferRef.current.length > 0 && !stateRef.current.request) {
      apply(bufferRef.current.shift() as MachineAction);
    }
  }, [apply]);

  const dispatch = useCallback(
    (action: MachineAction) => {
      if (stateRef.current.request) {
        bufferRef.current.push(action);
      } else {
        apply(action);
      }
    },
    [apply],
  );

  const request = stateRef.current.request;

  useEffect(() => {
    if (!request) return;

    let cancelled = false;

    void (async () => {
      try {
        const res = await calculate(request.op, request.a, request.b);
        if (cancelled) return;
        apply({ type: "resolve", result: res.result });
        setHistory((h) =>
          [
            {
              id: nextId.current++,
              expression:
                request.b != null
                  ? `${formatNumber(request.a)} ${OP_SYMBOL[request.op]} ${formatNumber(request.b)}`
                  : `${OP_SYMBOL[request.op]}${formatNumber(request.a)}`,
              result: res.result,
            },
            ...h,
          ].slice(0, HISTORY_LIMIT),
        );
      } catch (err) {
        if (cancelled) return;
        apply({ type: "reject", message: friendlyError(err) });
      } finally {
        if (!cancelled) flushBuffer();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [request, apply, flushBuffer]);

  const clearHistory = useCallback(() => setHistory([]), []);

  const state = stateRef.current;
  const status: Status = request ? "loading" : state.error ? "error" : "idle";
  return {
    value: displayValue(state),
    expression: expressionText(state),
    error: state.error,
    status,
    busy: status === "loading",
    history,
    dispatch,
    clearHistory,
  };
}
