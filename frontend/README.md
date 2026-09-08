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
All files       |   100   |   98.6   |   96.2  |   100
 src/api        |   100   |   95.5   |   100   |   100
 src/components |   100   |   98.3   |   92.3  |   100
 src/domain     |   100   |    100   |   100   |   100
 src/hooks      |   100   |    100   |   100   |   100
```

58 tests (Vitest + React Testing Library), no real network:

- **`domain/validation`** — `parseOperand` accepts ints, decimals, signs,
  scientific notation, surrounding whitespace; rejects empty, `"12abc"`,
  `"1,5"`, `Infinity`, `NaN`. `validateInputs` skips operand `b` for unary
  operations.
- **`domain/operations`** — the catalogue matches the API; `formatExpression`
  renders `a × b`, `√a`, and `15% of 200`.
- **`domain/format`** — integers verbatim, float noise trimmed
  (`0.1 + 0.2 → "0.3"`), real decimals kept, non-finite passed through.
- **`api/client`** — `fetch` is stubbed: success parsing, the server's error
  `code` is surfaced, missing envelope → `UNKNOWN`, thrown `fetch` → `NETWORK`,
  non-JSON 2xx → `UNKNOWN`.
- **`api/calculator`** — correct path/body per operation; `friendlyError`
  mapping and fallbacks.
- **`hooks/useCalculator`** — invalid input never calls the API and sets field
  errors; `validateField` flags a bad value on blur but stays quiet on an empty
  field; success records history (capped at 50); API error shows a friendly
  message and leaves history intact; unary omits `b`; `loading` state; `reset` /
  `clearHistory`.
- **`components/Calculator`** — full render: pick an operation, type, submit,
  see the formatted result; `sqrt` hides operand `b`; bad input is caught
  locally (no API call) and also flagged on blur; a rejected call shows the
  friendly message; history appends, paginates (5 per page), and clears;
  **Enter** submits.

---

## Design decisions

**The browser never does arithmetic.** Client validation is deliberately narrow
(just "is this a finite number?"), so there is exactly one place, the Go
service, where `2 / 0` is decided. This keeps the two layers honest and the
contract testable from both sides. Fields validate on blur so a typo is flagged
before you press Calculate, but an empty field is left alone until submit.

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

**No component library.** ~250 lines of hand-written CSS with custom properties
and a `prefers-color-scheme` dark theme keeps the bundle small (~64 kB gzipped)
and the markup honest.

**Stable layout, light motion.** Against a local API the request finishes in
milliseconds, so the result panel keeps the previous value on screen (dimmed)
during the request instead of flashing a placeholder, and the Calculate button
shows a spinner without changing width. The field error message is positioned in
reserved space so it never nudges the row. Entrances (result, history rows,
field errors) use short fades that collapse to nothing under
`prefers-reduced-motion`.

**History is paginated, not truncated.** Up to 50 entries are kept and shown 5
per page, newest first; a new calculation jumps back to page one.

**Trade-offs.** State is in-memory, so history resets on refresh; persistence
was out of scope. There is no request cancellation or debounce; disabling the
submit button while a request is in flight is enough for a calculator.

---

## Production / Docker

`npm run build` emits a static `dist/`. The [`Dockerfile`](Dockerfile) builds it
with Node, then serves it from `nginxinc/nginx-unprivileged` (non-root, port
8080) using [`nginx.conf`](nginx.conf), which also reverse-proxies `/api/` to
the backend and adds a `HEALTHCHECK`. The whole stack runs with
`docker compose up --build` from the repo root — see the
[root README](../README.md#docker-setup).

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
