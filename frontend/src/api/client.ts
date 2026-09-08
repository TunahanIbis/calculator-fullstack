/**
 * Minimal typed HTTP helper for talking to the calculator service.
 *
 * Everything the rest of the app needs is `ApiError` (a normalised failure with
 * a stable `code`) and `postJson` (a POST that always resolves to parsed data
 * or throws an `ApiError`). No third-party HTTP client — `fetch` is enough.
 */

/** Shape of the backend's error envelope: `{ "error": { code, message } }`. */
interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

/** A normalised API failure. `code` is safe to branch on. */
export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

/**
 * Base URL for the API. Empty by default so requests are relative (`/api/...`)
 * and handled by the dev proxy or the production reverse proxy. Override with
 * `VITE_API_BASE_URL` to point at an absolute origin.
 */
const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "";

export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

/**
 * POSTs `body` as JSON to `path` and returns the parsed response.
 *
 * Throws `ApiError` for any non-2xx response (using the server's `code` when
 * present), for network failures (`code: "NETWORK"`), and for unreadable
 * responses (`code: "UNKNOWN"`).
 */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "NETWORK",
      "Couldn't reach the calculator service. Is it running?",
    );
  }

  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const envelope = payload as ErrorEnvelope | undefined;
    throw new ApiError(
      envelope?.error?.code ?? "UNKNOWN",
      envelope?.error?.message ?? `Request failed (HTTP ${response.status})`,
    );
  }

  if (payload === undefined) {
    throw new ApiError("UNKNOWN", "The server returned an unreadable response.");
  }

  return payload as T;
}
