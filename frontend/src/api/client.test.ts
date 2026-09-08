import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, postJson } from "./client";

function mockFetch(impl: typeof fetch) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("postJson", () => {
  it("sends a JSON POST and returns the parsed body", async () => {
    mockFetch(async () => jsonResponse({ result: 5 }));

    const data = await postJson<{ result: number }>("/api/v1/add", { a: 2, b: 3 });

    expect(data).toEqual({ result: 5 });
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/add",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: 2, b: 3 }),
      }),
    );
  });

  it("throws ApiError with the server's code on a 4xx response", async () => {
    mockFetch(async () =>
      jsonResponse(
        { error: { code: "DIVISION_BY_ZERO", message: "division by zero is undefined" } },
        { status: 422 },
      ),
    );

    await expect(postJson("/api/v1/divide", { a: 1, b: 0 })).rejects.toMatchObject({
      name: "ApiError",
      code: "DIVISION_BY_ZERO",
      message: "division by zero is undefined",
    });
  });

  it("falls back to UNKNOWN when an error response has no envelope", async () => {
    mockFetch(async () => new Response("boom", { status: 500 }));

    await expect(postJson("/api/v1/add", {})).rejects.toMatchObject({
      code: "UNKNOWN",
      message: expect.stringContaining("HTTP 500"),
    });
  });

  it("maps a network failure to code NETWORK", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(postJson("/api/v1/add", {})).rejects.toBeInstanceOf(ApiError);
    await expect(postJson("/api/v1/add", {})).rejects.toMatchObject({
      code: "NETWORK",
    });
  });

  it("throws UNKNOWN when a 2xx body is not valid JSON", async () => {
    mockFetch(async () =>
      new Response("<html>nope</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );

    await expect(postJson("/api/v1/add", {})).rejects.toMatchObject({
      code: "UNKNOWN",
    });
  });
});
