# Full-Stack Calculator

A calculator application split into two independently deployable parts:

| Part                     | Stack                          | Tests            |
| ------------------------ | ------------------------------ | ---------------- |
| [`backend/`](backend/)   | Go 1.23, standard library only | 26 suites, ~90 % |
| [`frontend/`](frontend/) | React 19 + TypeScript + Vite   | 50 tests, ~99 %  |

The frontend is a thin client: **all arithmetic — including validation and edge
cases like division by zero — is performed by the backend REST API.**

<p align="center">
  <img src="docs/screenshot.png" alt="Calculator UI" width="420" />
</p>

---

## Architecture

```
┌─────────────────────┐        JSON over HTTP        ┌──────────────────────────┐
│  React SPA           │  ──────────────────────────▶ │  Go calculator service    │
│  (Vite dev server /  │   POST /api/v1/{operation}   │                          │
│   nginx static)      │  ◀────────────────────────── │  internal/calc  (pure)   │
│                      │   { result } | { error }     │  internal/httpapi (REST) │
└─────────────────────┘                              └──────────────────────────┘
```

- **`backend/internal/calc`** — arithmetic as pure `func(float64…) (float64, error)`
  with sentinel domain errors. No HTTP awareness; 100 % test coverage.
- **`backend/internal/httpapi`** — validates requests, maps domain errors to
  HTTP status codes (`400` = unparseable, `422` = semantically invalid), returns
  one consistent JSON envelope.
- **`frontend/src`** — layered `domain → api → hooks → components`. Components
  are presentational; `useCalculator` owns state and the submit workflow.

Full rationale: [backend design notes](backend/README.md#design-decisions) ·
[frontend design notes](frontend/README.md#design-decisions) ·
[OpenAPI 3.1 spec](backend/api/openapi.yaml).

---

## Quick start

### Option A — Docker (whole stack, one command)

```bash
docker compose up --build
# open http://localhost:8080
```

Only port **8080** is published. See [Docker setup](#docker-setup) below for how
it fits together.

### Option B — run each part locally

```bash
# terminal 1 — backend
cd backend && go run ./cmd/server        # :8080

# terminal 2 — frontend
cd frontend && npm install && npm run dev # :5173  (proxies /api to :8080)
```

Open http://localhost:5173.

---

## API at a glance

`POST` a JSON body to an operation endpoint; get JSON back.

```bash
curl -s -X POST localhost:8080/api/v1/divide -d '{"a": 22, "b": 7}'
# {"operation":"divide","a":22,"b":7,"result":3.142857142857143}

curl -s -X POST localhost:8080/api/v1/divide -d '{"a": 1, "b": 0}'
# {"error":{"code":"DIVISION_BY_ZERO","message":"division by zero is undefined"}}
```

| `POST /api/v1/…` | Body | | `POST /api/v1/…` | Body |
| --- | --- | --- | --- | --- |
| `add` | `{a, b}` | | `power` | `{a, b}` |
| `subtract` | `{a, b}` | | `sqrt` | `{a}` |
| `multiply` | `{a, b}` | | `percentage` | `{a, b}` → `a% of b` |
| `divide` | `{a, b}` | | `GET /healthz`, `GET /api/v1/operations` | — |

Full reference: [backend/README.md](backend/README.md#api-reference).

---

## Testing

```bash
cd backend  && go test ./... -covermode=count -coverprofile=coverage.out \
            && go tool cover -func=coverage.out       # ~90 %, calc pkg 100 %

cd frontend && npm run coverage                       # ~99 %, 50 tests
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs, on every push
and PR: `gofmt`/`go vet`/race tests for the backend, `eslint`/`tsc`/Vitest/build
for the frontend, both Docker images, and a smoke test that the composed stack
answers a real calculation.

---

## Docker setup

```
                       ┌───────────────── calculator-web (nginx-unprivileged) ──┐
  host :8080  ────────▶│  /            → dist/index.html  (SPA fallback)          │
                       │  /assets/*    → immutable-cached static bundle           │
                       │  /api/*       → proxy_pass ─────────────┐                │
                       └────────────────────────────────────────┼────────────────┘
                                                                ▼
                       ┌──────────── calculator-service (distroless) ────────────┐
                       │  Go binary, non-root, :8080, HEALTHCHECK "/server        │
                       │  healthcheck" (self-probes GET /healthz — no shell)      │
                       └─────────────────────────────────────────────────────────┘
```

| File | Role |
| ---- | ---- |
| [`backend/Dockerfile`](backend/Dockerfile) | Multi-stage: `golang:1.23-alpine` build → static `CGO_ENABLED=0` binary → `gcr.io/distroless/static` (non-root, no shell). Optional `--target test` stage runs `go vet` + `go test`. |
| [`frontend/Dockerfile`](frontend/Dockerfile) | Multi-stage: `node:22-alpine` → `npm ci` + `vite build` → `nginxinc/nginx-unprivileged` serving `dist/`. |
| [`frontend/nginx.conf`](frontend/nginx.conf) | Serves the SPA, hard-caches `/assets/*`, `try_files … /index.html` fallback, and reverse-proxies `/api/` to `backend:8080` (resolved per-request via Docker DNS). |
| [`docker-compose.yml`](docker-compose.yml) | Wires the two together on one network; `frontend` waits for `backend` to be `service_healthy`; only `8080` is published. |

Both services define a `HEALTHCHECK`, so `docker compose ps` shows real
health and the frontend never starts proxying to a backend that isn't ready.

The image builds and a compose smoke test (`{"a":2,"b":3}` → `{"result":5}`
through the running stack) run in CI. Locally the same nginx↔backend wiring —
SPA serving, asset caching, `/api` URI passthrough, and error passthrough —
is verified without the daemon by pointing a local nginx at `frontend/dist` and
a `go run` backend.

---

## Repository layout

```
.
├── backend/            Go microservice (REST API)
│   ├── api/openapi.yaml
│   ├── cmd/server/
│   └── internal/{app,calc,config,httpapi}/
├── frontend/           React + TypeScript client
│   └── src/{domain,api,hooks,components}/
├── docker-compose.yml  full stack behind one nginx port
├── .github/workflows/  CI pipeline
├── docs/screenshot.png
└── README.md
```

## License

[MIT](LICENSE)
