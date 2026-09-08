import { useCallback, useMemo, useRef, useState } from "react";

import {
  calculate,
  friendlyError,
  type CalculationResult,
} from "../api/calculator";
import {
  getOperation,
  formatExpression,
  type OperationId,
} from "../domain/operations";
import { validateInputs, type InputErrors } from "../domain/validation";

export type Status = "idle" | "loading" | "success" | "error";

/** Distinguishes a client-side validation failure from a server/API failure. */
export type ErrorKind = "validation" | "api" | null;

export interface HistoryEntry {
  id: number;
  expression: string;
  result: number;
}

const HISTORY_LIMIT = 8;

export interface CalculatorState {
  operationId: OperationId;
  rawA: string;
  rawB: string;
  status: Status;
  result: CalculationResult | null;
  /** Top-level error (API failure or "fix the fields" summary). */
  errorMessage: string | null;
  /** Whether `errorMessage` came from validation or from the API. */
  errorKind: ErrorKind;
  /** Per-field validation messages. */
  fieldErrors: InputErrors;
  history: HistoryEntry[];
}

export interface CalculatorActions {
  setOperation: (id: OperationId) => void;
  setA: (value: string) => void;
  setB: (value: string) => void;
  submit: () => Promise<void>;
  reset: () => void;
  clearHistory: () => void;
}

const INITIAL: CalculatorState = {
  operationId: "add",
  rawA: "",
  rawB: "",
  status: "idle",
  result: null,
  errorMessage: null,
  errorKind: null,
  fieldErrors: {},
  history: [],
};

/**
 * Owns all calculator state and the submit workflow: client-side validation,
 * the API call, and history. Components stay presentational.
 */
export function useCalculator(): CalculatorState & CalculatorActions {
  const [state, setState] = useState<CalculatorState>(INITIAL);
  const nextHistoryId = useRef(1);

  // Mirror of the latest state so `submit` never closes over a stale snapshot.
  const stateRef = useRef(state);
  stateRef.current = state;

  const setOperation = useCallback((id: OperationId) => {
    setState((s) => ({
      ...s,
      operationId: id,
      status: "idle",
      result: null,
      errorMessage: null,
      errorKind: null,
      fieldErrors: {},
    }));
  }, []);

  const setA = useCallback((value: string) => {
    setState((s) => ({
      ...s,
      rawA: value,
      fieldErrors: { ...s.fieldErrors, a: undefined },
      errorMessage: null,
      errorKind: null,
    }));
  }, []);

  const setB = useCallback((value: string) => {
    setState((s) => ({
      ...s,
      rawB: value,
      fieldErrors: { ...s.fieldErrors, b: undefined },
      errorMessage: null,
      errorKind: null,
    }));
  }, []);

  const reset = useCallback(() => {
    setState((s) => ({ ...INITIAL, history: s.history, operationId: s.operationId }));
  }, []);

  const clearHistory = useCallback(() => {
    setState((s) => ({ ...s, history: [] }));
  }, []);

  const submit = useCallback(async () => {
    const snapshot = stateRef.current;
    const operation = getOperation(snapshot.operationId);
    const validation = validateInputs(operation, snapshot.rawA, snapshot.rawB);

    if (!validation.ok) {
      setState((s) => ({
        ...s,
        status: "error",
        result: null,
        fieldErrors: validation.errors,
        errorMessage: "Please fix the highlighted field(s).",
        errorKind: "validation",
      }));
      return;
    }

    setState((s) => ({
      ...s,
      status: "loading",
      errorMessage: null,
      errorKind: null,
      fieldErrors: {},
    }));

    try {
      const result = await calculate(operation.id, validation.a, validation.b);
      setState((s) => ({
        ...s,
        status: "success",
        result,
        errorMessage: null,
        errorKind: null,
        history: [
          {
            id: nextHistoryId.current++,
            expression: formatExpression(operation, validation.a, validation.b),
            result: result.result,
          },
          ...s.history,
        ].slice(0, HISTORY_LIMIT),
      }));
    } catch (error) {
      setState((s) => ({
        ...s,
        status: "error",
        result: null,
        errorMessage: friendlyError(error),
        errorKind: "api",
      }));
    }
  }, []);

  const actions = useMemo(
    () => ({ setOperation, setA, setB, submit, reset, clearHistory }),
    [setOperation, setA, setB, submit, reset, clearHistory],
  );

  return { ...state, ...actions };
}
