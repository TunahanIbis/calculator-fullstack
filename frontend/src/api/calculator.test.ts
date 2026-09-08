import { afterEach, describe, expect, it, vi } from "vitest";

import { calculate, friendlyError } from "./calculator";
import { ApiError, postJson } from "./client";

// Mock only the network call; keep the real ApiError class.
vi.mock("./client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./client")>();
  return { ...actual, postJson: vi.fn() };
});

const postJsonMock = vi.mocked(postJson);

afterEach(() => {
  vi.clearAllMocks();
});

describe("calculate", () => {
  it("posts { a, b } to the operation path for a binary operation", async () => {
    postJsonMock.mockResolvedValue({ operation: "add", a: 2, b: 3, result: 5 });

    const result = await calculate("add", 2, 3);

    expect(postJsonMock).toHaveBeenCalledWith("/api/v1/add", { a: 2, b: 3 });
    expect(result.result).toBe(5);
  });

  it("omits b for a unary operation", async () => {
    postJsonMock.mockResolvedValue({ operation: "sqrt", a: 16, result: 4 });

    await calculate("sqrt", 16);

    expect(postJsonMock).toHaveBeenCalledWith("/api/v1/sqrt", { a: 16 });
  });

  it("propagates ApiError from the client", async () => {
    postJsonMock.mockRejectedValue(
      new ApiError("DIVISION_BY_ZERO", "division by zero is undefined"),
    );

    await expect(calculate("divide", 1, 0)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("friendlyError", () => {
  it("maps known error codes to a readable sentence", () => {
    expect(friendlyError(new ApiError("DIVISION_BY_ZERO", "x"))).toBe(
      "You can't divide by zero.",
    );
    expect(friendlyError(new ApiError("NEGATIVE_SQRT", "x"))).toContain(
      "negative number",
    );
    expect(friendlyError(new ApiError("NETWORK", "x"))).toContain("reach");
  });

  it("uses the server message for an unmapped ApiError code", () => {
    expect(friendlyError(new ApiError("WEIRD", "server said so"))).toBe(
      "server said so",
    );
  });

  it("returns a generic message for non-ApiError values", () => {
    expect(friendlyError(new Error("kaboom"))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(friendlyError("just a string")).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
