# Calculator Frontend

A React + TypeScript single-page calculator: a keypad, a two-line display, and
full keyboard support. **No arithmetic happens in the browser**, every sum is a
call to the Go API.

- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [How it talks to the API](#how-it-talks-to-the-api)
- [Testing & coverage](#testing--coverage)
- [Design decisions](#design-decisions)
- [Production / Docker](#production--docker)
- [Project layout](#project-layout)

---

## Quick start

Requires **Node 20+**.

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The dev server proxies `/api/*` to `http://localhost:8080`, so start the backend
(`cd ../backend && go run ./cmd/server`) in another terminal first.

| Script              | Does                                            |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Vite dev server with the API proxy             |
| `npm run build`     | Type-check (`tsc -b`) then bundle to `dist/`   |
| `npm run preview`   | Serve the production build locally             |
| `npm test`          | Run the unit / component suite once            |
| `npm run coverage`  | Run the suite with a coverage report          |
| `npm run lint`      | ESLint (typescript-eslint + react-hooks rules) |

---

## How it works

Enter a value on the keypad (or type it), pick an operator, enter the next
value, press `=`. Chained operations evaluate **left to right, like a basic
pocket calculator**, `2 + 3 × 4 =` is `20`, not `14`. There is no operator
precedence and no parentheses.

- **Operators:** `+  −  ×  ÷  ^` (power) and `%` (`a %  b` = `a` percent of `b`).
- **`√`** applies to the value on screen right away.
- **`C`** clears, **`⌫`** deletes a digit, **`±`** flips the sign.
- **Keyboard:** `0`–`9`, `.` / `,`, `+ - * / ^ %`, `Enter` / `=`, `Backspace`,
  `Esc` / `Delete`. Keystrokes carrying a modifier (Ctrl/⌘/Alt) are ignored so
  browser shortcuts still work.
- Every completed step is logged to a paginated **history** (4 per page).

Each press is one API call. A division by zero, a negative square root, or an
overflow comes back from the server as a friendly message on the display; the
next keystroke clears it.

---

## How it talks to the API

Requests are **relative** (`POST /api/v1/<operation>`). Something in front of the
app routes `/api` to the Go service:

| Environment   | Router                                          |
| ------------- | ---------------------------------------------- |
| `npm run dev` | Vite `server.proxy` → `http://localhost:8080`  |
| Docker        | nginx `location /api/` → `http://backend:8080` |
| Other         | set `VITE_API_BASE_URL` to an absolute origin  |

The client layer is two small files:

- **`src/api/client.ts`**, `postJson()` wraps `fetch`: it always resolves to
  parsed data or throws an `ApiError` with a stable `code` (`NETWORK` for a
  connection failure, `UNKNOWN` for an unreadable body, or the backend's own
  code such as `DIVISION_BY_ZERO`).
- **`src/api/calculator.ts`**, `calculate(op, a, b?)` builds the right body
  (omitting `b` for `sqrt`), plus `friendlyError()` which turns an `ApiError`
  code into a sentence for the display.

---

## Testing & coverage

```bash
npm run coverage
```

```
File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|--------
All files          |   100   |   ~95    |   100   |   100
 src/domain        |   100   |    92    |   100   |   100
 src/components     |   100   |    100   |   100   |   100
 src/hooks          |   100   |    93    |   100   |   100
 src/api            |   100   |    95    |   100   |   100
```

67 tests (Vitest + React Testing Library), no real network:

- **`domain/calculatorMachine`**, the pure state machine: entry building
  (leading zero, one decimal, length cap, backspace), binary ops and the
  `request` it emits, left-to-right chaining, operator swap, `a op =`,
  repeat-equals, `√` (standalone and mid-chain), `±`, and error / recovery
  transitions.
- **`domain/format`**, integers verbatim, float noise trimmed
  (`0.1 + 0.2 → "0.3"`), real decimals kept, non-finite passed through.
- **`api/client`**, `fetch` is stubbed: success parsing, the server's error
  `code` is surfaced, missing envelope → `UNKNOWN`, thrown `fetch` → `NETWORK`,
  non-JSON 2xx → `UNKNOWN`.
- **`api/calculator`**, correct path / body per operation; `friendlyError`
  mapping and fallbacks.
- **`hooks/useCalculator`**, one API call per step, history logging, unary
  omits `b`, a rejected call shows a friendly message and keeps history, and
  keystrokes typed **while a chained step is still resolving are buffered and
  replayed** (a deferred promise proves `25×18+40=` never loses a digit).
- **`components/Keypad`**, every key renders and emits the right action.
- **`components/HistoryList`**, empty state, 4-per-page pagination, newer /
  older navigation, `onClear`.
- **`components/Calculator`**, full render: click and keyboard entry, the
  formatted result and expression line, division-by-zero shows the friendly
  message while history survives, Clear / Backspace, the alternate keys
  (`x`, `^`, `%`, `,`, `Escape`), and modifier keys being ignored.

---

## Design decisions

**The browser never does arithmetic.** The state machine builds up an operation
and its operands, then hands `{ op, a, b }` to the API. There is exactly one
place, the Go service, where `2 / 0` is decided.

**A pure state machine.** `domain/calculatorMachine.ts` is a plain
`reducer(state, action)` with selectors (`displayValue`, `expressionText`). It
performs no arithmetic and no I/O, so every keypad interaction is covered by
fast, DOM-free table tests. `useCalculator` is the only place with side effects:
it watches for the machine's `request`, runs it, and feeds the answer back with
a `resolve` (or `reject`) action.

**Left to right, no precedence.** A four-function calculator has no operator
precedence, and adding a real expression parser (`(12 + 8) × 5`, `2^10 + 1`)
was explicitly out of scope for this assignment. Pressing an operator while one
is pending folds the earlier step first, so `25 × 18 + 40 =` is `490`.

**Input is never dropped.** Each `=`/operator is an async round-trip. Keystrokes
that arrive while a step is in flight are buffered in the hook and replayed once
it settles, so fast typing behaves the same as slow typing.

**Errors are typed, then humanised at the edge.** Internally every failure is an
`ApiError` with a `code`; `friendlyError()` converts to a sentence only when
rendering. The next keystroke clears the error and starts fresh.

**Accessible + keyboard-first.** Keys are real `<button>`s with `aria-label`s,
the display is an `aria-live` `output`, and a global `keydown` handler maps the
physical keyboard to the same actions. Both paths are covered by tests.

**Stable layout.** The display and history areas reserve their height, the error
message sits in the value slot rather than pushing content, and
`scrollbar-gutter: stable` keeps the centred card from shifting when a scrollbar
appears. Entrances use short fades that collapse under `prefers-reduced-motion`.

**No component library.** ~330 lines of hand-written CSS with custom properties
and a `prefers-color-scheme` dark theme; ~64 kB gzipped JS.

**Trade-offs.** State is in-memory, so history resets on refresh. There is no
request cancellation; a slow request just delays the next result.

---

## Production / Docker

`npm run build` emits a static `dist/`. The [`Dockerfile`](Dockerfile) builds it
with Node, then serves it from `nginxinc/nginx-unprivileged` (non-root, port
8080) using [`nginx.conf`](nginx.conf), which also reverse-proxies `/api/` to
the backend and adds a `HEALTHCHECK`. The whole stack runs with
`docker compose up --build` from the repo root; see the
[root README](../README.md#docker-setup).

---

## Project layout

```
frontend/
├── index.html
├── vite.config.ts             # dev proxy + Vitest config
├── nginx.conf                 # production reverse proxy (used by Dockerfile)
├── Dockerfile                 # node build -> nginx-unprivileged
└── src/
    ├── main.tsx               # bootstrap
    ├── App.tsx                # page shell
    ├── index.css              # theme + all styles
    ├── domain/
    │   ├── calculatorMachine.ts   # pure reducer + selectors  (no I/O)
    │   └── format.ts              # number formatting for display
    ├── api/                   # fetch client + typed operation calls
    ├── hooks/useCalculator.ts # machine + API round-trips + history + buffer
    └── components/            # Display, Keypad, HistoryList, Calculator
```
