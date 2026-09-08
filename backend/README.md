# Calculator Service (backend)

A small, stateless Go microservice that performs basic and advanced arithmetic
over a JSON REST API. It has **no third-party dependencies** — only the Go
standard library.

- [Quick start](#quick-start)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Error model](#error-model)
- [Testing & coverage](#testing--coverage)
- [Design decisions](#design-decisions)
- [Project layout](#project-layout)

---

## Quick start

Requires **Go 1.23+**.

```bash
cd backend
go run ./cmd/server
# {"time":"...","level":"INFO","msg":"calculator service listening","addr":":8080"}
```

Try it:

```bash
curl -s -X POST localhost:8080/api/v1/divide \
  -H 'Content-Type: application/json' \
  -d '{"a": 22, "b": 7}'
# {"operation":"divide","a":22,"b":7,"result":3.142857142857143}
```

Or with Docker:

```bash
docker build -t calculator-service .
docker run --rm -p 8080:8080 calculator-service
```

A `Makefile` wraps the common tasks (`make help` to list them), but every target
is just a plain `go` command — `make` is never required.

---

## Configuration

All configuration is via environment variables. Every variable is optional; the
defaults let the service run with zero configuration. See
[`.env.example`](.env.example).

| Variable               | Default                  | Description                                             |
| ---------------------- | ------------------------ | ----------------------------------------------------- |
| `PORT`                 | `8080`                   | TCP port to listen on                                  |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173`  | Comma-separated browser origin allow-list; `*` = any   |
| `READ_TIMEOUT`         | `5s`                     | HTTP read timeout (Go duration syntax)                 |
| `WRITE_TIMEOUT`        | `10s`                    | HTTP write timeout                                     |
| `SHUTDOWN_TIMEOUT`     | `10s`                    | Grace period for in-flight requests on SIGINT/SIGTERM  |
| `LOG_LEVEL`            | `info`                   | `debug` \| `info` \| `warn` \| `error`                 |

Invalid values (e.g. `READ_TIMEOUT=banana`) cause the process to exit at startup
with a clear message rather than silently falling back to a default.

---

## API reference

Base URL: `http://localhost:8080`. The full contract is also published as an
OpenAPI 3.1 document at [`api/openapi.yaml`](api/openapi.yaml).

### Operations

| Method | Path                     | Body                | Result                     |
| ------ | ------------------------ | ------------------- | -------------------------- |
| `POST` | `/api/v1/add`            | `{"a": …, "b": …}`  | `a + b`                    |
| `POST` | `/api/v1/subtract`       | `{"a": …, "b": …}`  | `a - b`                    |
| `POST` | `/api/v1/multiply`       | `{"a": …, "b": …}`  | `a * b`                    |
| `POST` | `/api/v1/divide`         | `{"a": …, "b": …}`  | `a / b` (rejects `b = 0`)  |
| `POST` | `/api/v1/power`          | `{"a": …, "b": …}`  | `a ^ b`                    |
| `POST` | `/api/v1/sqrt`           | `{"a": …}`          | `√a` (rejects `a < 0`)     |
| `POST` | `/api/v1/percentage`     | `{"a": …, "b": …}`  | `a` percent of `b` = `(a / 100) * b` |

### Meta

| Method | Path                  | Description                                        |
| ------ | --------------------- | ------------------------------------------------- |
| `GET`  | `/healthz`            | Liveness probe → `{"status":"ok"}`                |
| `GET`  | `/api/v1/operations`  | Self-describing catalogue of the operations above |

### Success response

```jsonc
// POST /api/v1/power  {"a": 2, "b": 10}
{
  "operation": "power",
  "a": 2,
  "b": 10,        // omitted for unary operations (sqrt)
  "result": 1024
}
```

### Examples

```bash
# Addition
curl -s -X POST localhost:8080/api/v1/add -d '{"a": 2, "b": 3}'
# {"operation":"add","a":2,"b":3,"result":5}

# Square root
curl -s -X POST localhost:8080/api/v1/sqrt -d '{"a": 144}'
# {"operation":"sqrt","a":144,"result":12}

# Division by zero → 422
curl -s -X POST localhost:8080/api/v1/divide -d '{"a": 1, "b": 0}'
# {"error":{"code":"DIVISION_BY_ZERO","message":"division by zero is undefined"}}

# Unknown field → 400
curl -s -X POST localhost:8080/api/v1/add -d '{"a": 1, "b": 2, "c": 3}'
# {"error":{"code":"INVALID_JSON","message":"request body contains unsupported field \"c\""}}
```

---

## Error model

Every non-2xx response uses one envelope:

```json
{ "error": { "code": "DIVISION_BY_ZERO", "message": "division by zero is undefined" } }
```

`code` is stable and meant for programmatic branching; `message` is
human-readable and may change.

| HTTP | `code`                | When                                                           |
| ---- | --------------------- | ------------------------------------------------------------- |
| 400  | `INVALID_JSON`        | Body is missing, malformed, has wrong types, unknown fields, or trailing data |
| 404  | `NOT_FOUND`           | Unknown route                                                  |
| 405  | `METHOD_NOT_ALLOWED`  | Known route, wrong HTTP method (`Allow` header included)       |
| 422  | `VALIDATION_ERROR`    | Well-formed JSON, but a required operand is missing / an extra operand supplied |
| 422  | `DIVISION_BY_ZERO`    | `divide` with `b = 0`                                          |
| 422  | `NEGATIVE_SQRT`       | `sqrt` with `a < 0`                                            |
| 422  | `NON_FINITE_NUMBER`   | Operand is `NaN`/`±Inf`, or the result overflows (e.g. `10 ^ 400`) |
| 500  | `INTERNAL_ERROR`      | Unexpected server error (also returned by the panic recovery middleware) |

**Why `400` vs `422`?** `400` means "I can't parse this request". `422` means
"I parsed it fine, but it doesn't make sense" — the request is syntactically
valid JSON but semantically or mathematically invalid.

---

## Testing & coverage

```bash
make test          # go test -race ./...
make cover         # writes coverage.out and prints a per-function report
make cover-html    # opens the HTML report
```

Current coverage (`go test ./... -covermode=count`):

```
internal/calc       100.0%
internal/httpapi      98.0%
internal/app          94.4%
internal/config       93.0%
------------------------------
total                 ~90%
```

`cmd/server/main.go` is a thin wiring shim (parse config → build server → run);
its behaviour is exercised through `internal/app`.

**What is tested**

- `internal/calc` — table-driven tests for every operation: happy paths, float
  rounding, division/`sqrt`/overflow edge cases, and `NaN`/`Inf` rejection.
- `internal/httpapi` — the full router (with middleware) via `httptest`: every
  endpoint, each error `code`/status, malformed bodies, unknown fields, oversized
  bodies, method/route mismatches, CORS preflight and disallowed origins, and the
  panic-recovery middleware.
- `internal/config` — defaults, overrides, alias parsing, and rejection of
  invalid values.
- `internal/app` — server serves `/healthz`, returns cleanly on context
  cancellation (graceful shutdown), and surfaces a bind error.

---

## Design decisions

**Standard library only.** Go 1.22's `net/http.ServeMux` supports
method-and-path patterns (`POST /api/v1/add`), so a third-party router adds
nothing here. Zero dependencies means nothing to audit, a trivial `go.mod`, and
a `scratch`-sized container.

**Domain logic is isolated in `internal/calc`.** These functions take `float64`
and return `(float64, error)` with no knowledge of HTTP or JSON. Domain errors
are sentinel values (`calc.ErrDivideByZero`, …) that the HTTP layer maps to
status codes with `errors.Is`. The math is unit-testable on its own and could be
reused by a CLI or a queue consumer unchanged.

**One handler factory, a table of operations.** `operations` (in `handler.go`)
is the single source of truth: it drives routing, the `/api/v1/operations`
discovery endpoint, and the 404-vs-405 fallback. Adding an operation is one
table row plus one function in `calc`.

**Strict request parsing.** Bodies are size-limited (`1 KiB`), reject unknown
fields, and reject trailing data. Operands are `*float64` so a missing field is
distinguishable from an explicit `0`.

**Result sanity checks.** Any operation whose result is `±Inf` or `NaN`
(overflow, `0 ^ -1`, …) returns `NON_FINITE_NUMBER` rather than emitting invalid
JSON or a misleading number.

**Operational niceties.** Structured JSON logging (`log/slog`), one log line per
request with status and latency, panic-recovery middleware, scoped CORS, HTTP
timeouts, and signal-driven graceful shutdown.

**Trade-offs / non-goals.** No auth, rate limiting, persistence, or arbitrary
expression parsing (`"2 + 3 * 4"`) — each operation is an explicit endpoint. All
arithmetic is IEEE-754 `float64`, so very large magnitudes and repeating
decimals carry the usual floating-point imprecision; arbitrary-precision math
was out of scope.

---

## Project layout

```
backend/
├── api/
│   └── openapi.yaml         # OpenAPI 3.1 contract
├── cmd/
│   └── server/
│       └── main.go          # entrypoint: config -> server -> run
├── internal/
│   ├── app/                 # server construction + graceful shutdown
│   ├── calc/                # pure arithmetic + domain errors  (no HTTP)
│   ├── config/              # env-var configuration with defaults
│   └── httpapi/             # router, handlers, middleware, JSON responses
├── Dockerfile               # multi-stage build -> distroless
├── Makefile                 # dev task shortcuts
└── go.mod                   # module definition (no dependencies)
```
