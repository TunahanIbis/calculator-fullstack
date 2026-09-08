# Full-Stack Calculator

A calculator application split into two independently deployable parts:

| Part                     | Stack                     | Status        |
| ------------------------ | ------------------------- | ------------- |
| [`backend/`](backend/)   | Go 1.23, standard library only | ✅ Complete |
| [`frontend/`](frontend/) | React + TypeScript + Vite | 🚧 In progress |

The frontend is a thin client: all arithmetic — including validation and edge
cases like division by zero — is performed by the backend REST API.

---

## Architecture

```
┌─────────────────────┐        JSON over HTTP        ┌──────────────────────────┐
│  React SPA           │  ──────────────────────────▶ │  Go calculator service    │
│  (Vite dev server /  │   POST /api/v1/{operation}   │                          │
│   static build)      │  ◀────────────────────────── │  internal/calc  (pure)   │
│                      │   { result } | { error }     │  internal/httpapi (REST) │
└─────────────────────┘                              └──────────────────────────┘
```

- **`internal/calc`** holds the arithmetic as pure `func(float64…) (float64, error)`
  with sentinel domain errors. No HTTP awareness — trivially unit-testable.
- **`internal/httpapi`** validates requests, maps domain errors to HTTP status
  codes, and returns a single consistent JSON envelope.
- The React app renders UI state from the API response and never re-implements
  the math.

See [`backend/README.md`](backend/README.md#design-decisions) for the full
design rationale and [`backend/api/openapi.yaml`](backend/api/openapi.yaml) for
the API contract.

---

## Quick start

### Backend

```bash
cd backend
go run ./cmd/server          # listens on :8080
curl -s -X POST localhost:8080/api/v1/add -d '{"a": 2, "b": 3}'
# {"operation":"add","a":2,"b":3,"result":5}
```

### Frontend

_Added in the frontend phase._

### Everything at once (Docker)

_`docker-compose.yml` is added with the frontend._

---

## Testing

```bash
cd backend && make cover     # unit tests + coverage report (~90%, calc at 100%)
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `gofmt`,
`go vet`, the race-enabled test suite with coverage, and a Docker image build on
every push and pull request.

---

## Repository layout

```
.
├── backend/            Go microservice (REST API)
│   ├── api/openapi.yaml
│   ├── cmd/server/
│   └── internal/{app,calc,config,httpapi}/
├── frontend/           React + TypeScript client   (in progress)
├── .github/workflows/  CI pipeline
└── README.md           you are here
```

## License

[MIT](LICENSE)
