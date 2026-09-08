# Calculator Frontend

A React + TypeScript single-page app for the calculator service. It collects
input, validates it, calls the REST API, and renders the response. **No
arithmetic happens in the browser** — the backend is the source of truth.

- [Quick start](#quick-start)
- [How it talks to the API](#how-it-talks-to-the-api)
- [Testing & coverage](#testing--coverage)
- [Design decisions](#design-decisions)
- [Project layout](#project-layout)

---

## Quick start

Requires **Node 20+**.

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The dev server proxies `/api/*` to `http://localhost:8080`, so start the
backend (`cd ../backend && go run ./cmd/server`) in another terminal first.

| Script              | Does                                             |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Vite dev server with API proxy                   |
| `npm run build`     | Type-check (`tsc -b`) then bundle to `dist/`     |
| `npm run preview`   | Serve the production build locally               |
| `npm test`          | Run the unit/component suite once                |
| `npm run coverage`  | Run the suite with a coverage report            |
| `npm run lint`      | ESLint (typescript-eslint + react-hooks rules)   |

---

## How it talks to the API

Requests are **relative** (`POST /api/v1/<operation>`). Something in front of the
app routes `/api` to the Go service:

| Environment | Router                                             |
| ----------- | ------------------------------------------------- |
| `npm run dev` | Vite `server.proxy` → `http://localhost:8080`   |
| Docker      | nginx `location /api/` → `http://backend:8080`    |
| Other       | set `VITE_API_BASE_URL` to an absolute origin     |

The client layer is two small files:

- **`src/api/client.ts`** — `postJson()` wraps `fetch`: it always resolves to
  parsed data or throws an `ApiError` with a stable `code` (`NETWORK` for a
  connection failure, `UNKNOWN` for an unreadable body, or the backend's own
  code such as `DIVISION_BY_ZERO`).
- **`src/api/calculator.ts`** — `calculate(op, a, b?)` builds the right body
  (omitting `b` for `sqrt`), plus `friendlyError()` which turns an `ApiError`
  code into a sentence for the UI.

---

## Testing & coverage

```bash
npm run coverage
```

```
File            | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
All files       |  99.5   |   97.3   |   100   |  99.5
 src/api        |   100   |   95.5   |   100   |   100
 src/components |  98.9   |   95.5   |   100   |  98.9
 src/domain     |   100   |    100   |   100   |   100
 src/hooks      |   100   |    100   |   100   |   100
```

50 tests (Vitest + React Testing Library), no real network:

- **`domain/validation`** — `parseOperand` accepts ints, decimals, signs,
  scientific notation, surrounding whitespace; rejects empty, `"12abc"`,
  `"1,5"`, `Infinity`, `NaN`. `validateInputs` skips operand `b` for unary
  operations.
- **`domain/operations`** — the catalogue matches the API; `formatExpression`
  renders `a × b`, `√a`, and `15% of 200`.
- **`api/client`** — `fetch` is stubbed: success parsing, the server's error
  `code` is surfaced, missing envelope → `UNKNOWN`, thrown `fetch` → `NETWORK`,
  non-JSON 2xx → `UNKNOWN`.
- **`api/calculator`** — correct path/body per operation; `friendlyError`
  mapping and fallbacks.
- **`hooks/useCalculator`** — invalid input never calls the API and sets field
  errors; success records history; API error shows a friendly message and
  leaves history intact; unary omits `b`; `loading` state; `reset` /
  `clearHistory`.
- **`components/Calculator`** — full render: pick an operation, type, submit,
  see the formatted result; `sqrt` hides operand `b`; bad input is caught
  locally (no API call); a rejected call shows the friendly message; history
  appends and clears; **Enter** submits.

---

## Design decisions

**The browser never does arithmetic.** Client validation is deliberately narrow
— "is this a finite number?" — so there is exactly one place (the Go service)
where `2 / 0` is decided. This keeps the two layers honest and the contract
testable from both sides.

**Layered, framework-light.** `domain/` (pure functions) → `api/` (fetch) →
`hooks/useCalculator` (all state + the submit workflow) → `components/`
(presentational). Components hold no business logic, so they are cheap to test
and the workflow can be tested without a DOM.

**One operations table.** `domain/operations.ts` mirrors the backend catalogue
and drives the picker, the arity logic, and the API path. Adding an operation is
one row.

**Errors are typed, then humanised at the edge.** Internally everything is an
`ApiError` with a `code`; `friendlyError()` converts to a sentence only when
rendering. `400`-class problems (bad input) are shown inline on the fields;
`422`-class problems (division by zero) are shown in the result panel.

**Accessible by default.** The picker is a real `radiogroup`, inputs have
`<label>`s and `aria-describedby` error links, the result is an `aria-live`
`output`, and the whole form submits on Enter.

**No component library.** ~200 lines of hand-written CSS with custom properties
and a `prefers-color-scheme` dark theme keeps the bundle small (~63 kB gzipped)
and the markup honest.

**Trade-offs.** State is in-memory (history resets on refresh) — persistence
was out of scope. There is no request cancellation or debounce; the submit
button is disabled while a request is in flight, which is enough for a
calculator.

---

## Project layout

```
frontend/
├── index.html
├── vite.config.ts          # dev proxy + Vitest config
├── nginx.conf              # production reverse proxy (used by Dockerfile)
├── Dockerfile              # node build -> nginx-unprivileged
└── src/
    ├── main.tsx            # bootstrap
    ├── App.tsx             # page shell
    ├── index.css           # theme + all styles
    ├── domain/             # operations table, input validation  (pure)
    ├── api/                # fetch client + typed operation calls
    ├── hooks/              # useCalculator — state + submit workflow
    ├── components/         # OperationPicker, OperandInput, ResultPanel,
    │                       # HistoryList, Calculator
    └── test/setup.ts       # jest-dom matchers + RTL cleanup
```
