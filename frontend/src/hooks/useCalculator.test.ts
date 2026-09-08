import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import { calculate } from "../api/calculator";
import { useCalculator } from "./useCalculator";

vi.mock("../api/calculator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/calculator")>();
  return { ...actual, calculate: vi.fn() };
});

const calculateMock = vi.mocked(calculate);

beforeEach(() => {
  calculateMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useCalculator", () => {
  it("starts showing 0 with no history", () => {
    const { result } = renderHook(() => useCalculator());
    expect(result.current.value).toBe("0");
    expect(result.current.expression).toBe("");
    expect(result.current.history).toEqual([]);
    expect(result.current.status).toBe("idle");
  });

  it("runs a calculation on '=' and records history", async () => {
    calculateMock.mockResolvedValue({ operation: "add", a: 2, b: 3, result: 5 });
    const { result } = renderHook(() => useCalculator());

    act(() => {
      result.current.dispatch({ type: "digit", value: "2" });
      result.current.dispatch({ type: "operator", op: "add" });
      result.current.dispatch({ type: "digit", value: "3" });
      result.current.dispatch({ type: "equals" });
    });

    await waitFor(() => expect(result.current.value).toBe("5"));
    expect(calculateMock).toHaveBeenCalledWith("add", 2, 3);
    expect(result.current.expression).toBe("2 + 3 =");
    expect(result.current.history[0]).toMatchObject({ expression: "2 + 3", result: 5 });
  });

  it("makes one API call per step when chaining", async () => {
    calculateMock
      .mockResolvedValueOnce({ operation: "add", a: 7, b: 6, result: 13 })
      .mockResolvedValueOnce({ operation: "multiply", a: 13, b: 2, result: 26 });
    const { result } = renderHook(() => useCalculator());

    act(() => {
      result.current.dispatch({ type: "digit", value: "7" });
      result.current.dispatch({ type: "operator", op: "add" });
      result.current.dispatch({ type: "digit", value: "6" });
      result.current.dispatch({ type: "operator", op: "multiply" });
    });
    await waitFor(() => expect(result.current.value).toBe("13"));

    act(() => {
      result.current.dispatch({ type: "digit", value: "2" });
      result.current.dispatch({ type: "equals" });
    });
    await waitFor(() => expect(result.current.value).toBe("26"));

    expect(calculateMock).toHaveBeenNthCalledWith(1, "add", 7, 6);
    expect(calculateMock).toHaveBeenNthCalledWith(2, "multiply", 13, 2);
    expect(result.current.history).toHaveLength(2);
  });

  it("buffers keystrokes typed while a chained step is still resolving", async () => {
    // First step (multiply) resolves only when we let it.
    let release!: (r: { operation: "multiply"; a: number; b: number; result: number }) => void;
    calculateMock
      .mockImplementationOnce(
        () => new Promise((res) => { release = res; }),
      )
      .mockResolvedValueOnce({ operation: "add", a: 450, b: 40, result: 490 });
    const { result } = renderHook(() => useCalculator());

    // 25 × 18 + 40 =   (types "+ 40 =" before multiply comes back)
    act(() => {
      "25".split("").forEach((c) => result.current.dispatch({ type: "digit", value: c }));
      result.current.dispatch({ type: "operator", op: "multiply" });
      "18".split("").forEach((c) => result.current.dispatch({ type: "digit", value: c }));
      result.current.dispatch({ type: "operator", op: "add" }); // fires the multiply request
      "40".split("").forEach((c) => result.current.dispatch({ type: "digit", value: c }));
      result.current.dispatch({ type: "equals" });
    });

    await act(async () => {
      release({ operation: "multiply", a: 25, b: 18, result: 450 });
    });

    await waitFor(() => expect(result.current.value).toBe("490"));
    expect(calculateMock).toHaveBeenNthCalledWith(2, "add", 450, 40);
  });

  it("omits b for a unary operation", async () => {
    calculateMock.mockResolvedValue({ operation: "sqrt", a: 144, result: 12 });
    const { result } = renderHook(() => useCalculator());

    act(() => {
      "144".split("").forEach((c) =>
        result.current.dispatch({ type: "digit", value: c }),
      );
      result.current.dispatch({ type: "unary", op: "sqrt" });
    });

    await waitFor(() => expect(result.current.value).toBe("12"));
    expect(calculateMock).toHaveBeenCalledWith("sqrt", 144, undefined);
    expect(result.current.history[0]).toMatchObject({ expression: "√144", result: 12 });
  });

  it("surfaces a friendly message when the API rejects, and keeps history", async () => {
    calculateMock
      .mockResolvedValueOnce({ operation: "add", a: 1, b: 1, result: 2 })
      .mockRejectedValueOnce(new ApiError("DIVISION_BY_ZERO", "nope"));
    const { result } = renderHook(() => useCalculator());

    act(() => {
      result.current.dispatch({ type: "digit", value: "1" });
      result.current.dispatch({ type: "operator", op: "add" });
      result.current.dispatch({ type: "digit", value: "1" });
      result.current.dispatch({ type: "equals" });
    });
    await waitFor(() => expect(result.current.value).toBe("2"));
    expect(result.current.history).toHaveLength(1);

    act(() => {
      result.current.dispatch({ type: "digit", value: "8" });
      result.current.dispatch({ type: "operator", op: "divide" });
      result.current.dispatch({ type: "digit", value: "0" });
      result.current.dispatch({ type: "equals" });
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("You can't divide by zero.");
    expect(result.current.history).toHaveLength(1); // unchanged
  });

  it("clearHistory empties the log", async () => {
    calculateMock.mockResolvedValue({ operation: "add", a: 1, b: 1, result: 2 });
    const { result } = renderHook(() => useCalculator());

    act(() => {
      result.current.dispatch({ type: "digit", value: "1" });
      result.current.dispatch({ type: "operator", op: "add" });
      result.current.dispatch({ type: "digit", value: "1" });
      result.current.dispatch({ type: "equals" });
    });
    await waitFor(() => expect(result.current.history).toHaveLength(1));

    act(() => result.current.clearHistory());
    expect(result.current.history).toEqual([]);
  });
});
