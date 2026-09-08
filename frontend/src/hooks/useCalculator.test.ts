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
  it("starts idle with add selected and no result", () => {
    const { result } = renderHook(() => useCalculator());

    expect(result.current.status).toBe("idle");
    expect(result.current.operationId).toBe("add");
    expect(result.current.result).toBeNull();
    expect(result.current.history).toEqual([]);
  });

  it("does not call the API when inputs are invalid, and reports field errors", async () => {
    const { result } = renderHook(() => useCalculator());

    act(() => result.current.setA("abc"));
    await act(() => result.current.submit());

    expect(calculateMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.errorKind).toBe("validation");
    expect(result.current.fieldErrors.a).toBe("Not a valid number");
  });

  it("validateField flags a bad value but stays quiet on an empty field", () => {
    const { result } = renderHook(() => useCalculator());

    act(() => result.current.validateField("a"));
    expect(result.current.fieldErrors.a).toBeUndefined(); // empty: no nag

    act(() => result.current.setA("abc"));
    act(() => result.current.validateField("a"));
    expect(result.current.fieldErrors.a).toBe("Not a valid number");

    // b is irrelevant for a unary operation and must never get an error here.
    act(() => result.current.setOperation("sqrt"));
    act(() => result.current.setB("nonsense"));
    act(() => result.current.validateField("b"));
    expect(result.current.fieldErrors.b).toBeUndefined();
  });

  it("keeps up to 50 history entries", async () => {
    let n = 0;
    calculateMock.mockImplementation(async () => {
      n += 1;
      return { operation: "add", a: n, b: 0, result: n };
    });
    const { result } = renderHook(() => useCalculator());

    for (let i = 0; i < 55; i += 1) {
      act(() => {
        result.current.setA(String(i));
        result.current.setB("0");
      });
      await act(() => result.current.submit());
    }
    expect(result.current.history).toHaveLength(50);
  });

  it("calls the API and records history on success", async () => {
    calculateMock.mockResolvedValue({ operation: "add", a: 2, b: 3, result: 5 });
    const { result } = renderHook(() => useCalculator());

    act(() => {
      result.current.setA("2");
      result.current.setB("3");
    });
    await act(() => result.current.submit());

    expect(calculateMock).toHaveBeenCalledWith("add", 2, 3);
    expect(result.current.status).toBe("success");
    expect(result.current.result?.result).toBe(5);
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toMatchObject({
      expression: "2 + 3",
      result: 5,
    });
  });

  it("surfaces a friendly message on an API error and keeps history intact", async () => {
    calculateMock
      .mockResolvedValueOnce({ operation: "add", a: 1, b: 1, result: 2 })
      .mockRejectedValueOnce(
        new ApiError("DIVISION_BY_ZERO", "division by zero is undefined"),
      );
    const { result } = renderHook(() => useCalculator());

    act(() => {
      result.current.setA("1");
      result.current.setB("1");
    });
    await act(() => result.current.submit());
    expect(result.current.history).toHaveLength(1);

    act(() => result.current.setOperation("divide"));
    act(() => {
      result.current.setA("1");
      result.current.setB("0");
    });
    await act(() => result.current.submit());

    expect(result.current.status).toBe("error");
    expect(result.current.errorKind).toBe("api");
    expect(result.current.errorMessage).toBe("You can't divide by zero.");
    expect(result.current.history).toHaveLength(1); // unchanged
  });

  it("omits operand b for a unary operation", async () => {
    calculateMock.mockResolvedValue({ operation: "sqrt", a: 144, result: 12 });
    const { result } = renderHook(() => useCalculator());

    act(() => result.current.setOperation("sqrt"));
    act(() => result.current.setA("144"));
    await act(() => result.current.submit());

    expect(calculateMock).toHaveBeenCalledWith("sqrt", 144, undefined);
    expect(result.current.result?.result).toBe(12);
  });

  it("shows a loading status while the request is in flight", async () => {
    let resolve!: (v: {
      operation: "add";
      a: number;
      b: number;
      result: number;
    }) => void;
    calculateMock.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { result } = renderHook(() => useCalculator());

    act(() => {
      result.current.setA("2");
      result.current.setB("2");
    });
    let submitPromise: Promise<void>;
    act(() => {
      submitPromise = result.current.submit();
    });

    await waitFor(() => expect(result.current.status).toBe("loading"));

    await act(async () => {
      resolve({ operation: "add", a: 2, b: 2, result: 4 });
      await submitPromise;
    });
    expect(result.current.status).toBe("success");
  });

  it("reset clears inputs and result but keeps history", async () => {
    calculateMock.mockResolvedValue({ operation: "add", a: 2, b: 3, result: 5 });
    const { result } = renderHook(() => useCalculator());

    act(() => {
      result.current.setA("2");
      result.current.setB("3");
    });
    await act(() => result.current.submit());

    act(() => result.current.reset());

    expect(result.current.rawA).toBe("");
    expect(result.current.rawB).toBe("");
    expect(result.current.result).toBeNull();
    expect(result.current.status).toBe("idle");
    expect(result.current.history).toHaveLength(1);
  });

  it("clearHistory empties the log", async () => {
    calculateMock.mockResolvedValue({ operation: "add", a: 1, b: 1, result: 2 });
    const { result } = renderHook(() => useCalculator());

    act(() => {
      result.current.setA("1");
      result.current.setB("1");
    });
    await act(() => result.current.submit());
    expect(result.current.history).toHaveLength(1);

    act(() => result.current.clearHistory());
    expect(result.current.history).toEqual([]);
  });
});
