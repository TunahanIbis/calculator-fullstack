package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/TunahanIbis/calculator-fullstack/backend/internal/calc"
)

// maxBodyBytes caps the size of a request body we are willing to read. The
// calculator only ever needs a tiny JSON object, so 1 KiB is generous.
const maxBodyBytes = 1 << 10

// binaryFunc / unaryFunc are the shapes of the calc package operations.
type binaryFunc func(a, b float64) (float64, error)
type unaryFunc func(a float64) (float64, error)

// operation describes one calculator endpoint for both routing and the
// self-describing GET /api/v1/operations response.
type operation struct {
	Name        string `json:"name"`
	Method      string `json:"method"`
	Path        string `json:"path"`
	Arity       int    `json:"arity"` // number of operands: 1 or 2
	Description string `json:"description"`
	Example     string `json:"example"`
	binary      binaryFunc
	unary       unaryFunc
}

// operations is the single source of truth for the API surface.
var operations = []operation{
	{Name: "add", Method: http.MethodPost, Path: "/api/v1/add", Arity: 2,
		Description: "Add two numbers (a + b).", Example: `{"a": 2, "b": 3}`, binary: calc.Add},
	{Name: "subtract", Method: http.MethodPost, Path: "/api/v1/subtract", Arity: 2,
		Description: "Subtract b from a (a - b).", Example: `{"a": 10, "b": 4}`, binary: calc.Subtract},
	{Name: "multiply", Method: http.MethodPost, Path: "/api/v1/multiply", Arity: 2,
		Description: "Multiply two numbers (a * b).", Example: `{"a": 6, "b": 7}`, binary: calc.Multiply},
	{Name: "divide", Method: http.MethodPost, Path: "/api/v1/divide", Arity: 2,
		Description: "Divide a by b (a / b). Rejects b = 0.", Example: `{"a": 10, "b": 3}`, binary: calc.Divide},
	{Name: "power", Method: http.MethodPost, Path: "/api/v1/power", Arity: 2,
		Description: "Raise a to the power b (a ^ b).", Example: `{"a": 2, "b": 10}`, binary: calc.Power},
	{Name: "sqrt", Method: http.MethodPost, Path: "/api/v1/sqrt", Arity: 1,
		Description: "Square root of a. Rejects a < 0.", Example: `{"a": 144}`, unary: calc.Sqrt},
	{Name: "percentage", Method: http.MethodPost, Path: "/api/v1/percentage", Arity: 2,
		Description: "a percent of b, i.e. (a / 100) * b.", Example: `{"a": 15, "b": 200}`, binary: calc.Percentage},
}

// calcRequest is the accepted request body for every operation. Fields are
// pointers so that a missing field can be told apart from an explicit zero.
type calcRequest struct {
	A *float64 `json:"a"`
	B *float64 `json:"b"`
}

// calcResponse is the success envelope. B is omitted for unary operations.
type calcResponse struct {
	Operation string   `json:"operation"`
	A         float64  `json:"a"`
	B         *float64 `json:"b,omitempty"`
	Result    float64  `json:"result"`
}

// handleOperation returns the http.HandlerFunc for a single operation.
func handleOperation(op operation) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req, ok := decodeRequest(w, r)
		if !ok {
			return
		}

		missing := make([]string, 0, 2)
		if req.A == nil {
			missing = append(missing, "a")
		}
		if op.Arity == 2 && req.B == nil {
			missing = append(missing, "b")
		}
		if len(missing) > 0 {
			writeError(w, http.StatusUnprocessableEntity, CodeValidation,
				fmt.Sprintf("missing required numeric field(s): %s", strings.Join(missing, ", ")))
			return
		}
		if op.Arity == 1 && req.B != nil {
			writeError(w, http.StatusUnprocessableEntity, CodeValidation,
				fmt.Sprintf("operation %q takes a single operand; do not send \"b\"", op.Name))
			return
		}

		var (
			result float64
			err    error
		)
		if op.Arity == 2 {
			result, err = op.binary(*req.A, *req.B)
		} else {
			result, err = op.unary(*req.A)
		}
		if err != nil {
			writeCalcError(w, err)
			return
		}

		resp := calcResponse{Operation: op.Name, A: *req.A, Result: result}
		if op.Arity == 2 {
			resp.B = req.B
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// decodeRequest reads and validates the JSON body, writing an error response
// and returning ok == false if anything is wrong.
func decodeRequest(w http.ResponseWriter, r *http.Request) (calcRequest, bool) {
	var req calcRequest

	dec := json.NewDecoder(io.LimitReader(r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()

	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, CodeInvalidJSON, decodeErrorMessage(err))
		return req, false
	}
	if dec.More() {
		writeError(w, http.StatusBadRequest, CodeInvalidJSON,
			"request body must contain exactly one JSON object")
		return req, false
	}
	return req, true
}

// decodeErrorMessage turns a json decode error into a friendly, safe message.
func decodeErrorMessage(err error) string {
	var syntaxErr *json.SyntaxError
	var typeErr *json.UnmarshalTypeError

	switch {
	case errors.Is(err, io.EOF):
		return "request body must not be empty"
	case errors.As(err, &syntaxErr):
		return "request body contains malformed JSON"
	case errors.As(err, &typeErr):
		return fmt.Sprintf("field %q must be a JSON number", typeErr.Field)
	case strings.HasPrefix(err.Error(), "json: unknown field "):
		field := strings.TrimPrefix(err.Error(), "json: unknown field ")
		return fmt.Sprintf("request body contains unsupported field %s", field)
	default:
		return "request body could not be parsed as JSON"
	}
}

// writeCalcError maps a calc domain error to the right HTTP status and code.
func writeCalcError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, calc.ErrDivideByZero):
		writeError(w, http.StatusUnprocessableEntity, CodeDivisionByZero, err.Error())
	case errors.Is(err, calc.ErrNegativeSqrt):
		writeError(w, http.StatusUnprocessableEntity, CodeNegativeSqrt, err.Error())
	case errors.Is(err, calc.ErrNonFiniteInput), errors.Is(err, calc.ErrNonFiniteResult):
		writeError(w, http.StatusUnprocessableEntity, CodeNonFinite, err.Error())
	default:
		slog.Error("unhandled calculation error", "error", err)
		writeError(w, http.StatusInternalServerError, CodeInternal, "internal error")
	}
}

// --- discovery / health endpoints ---

func handleListOperations(w http.ResponseWriter, _ *http.Request) {
	type publicOp struct {
		Name        string `json:"name"`
		Method      string `json:"method"`
		Path        string `json:"path"`
		Arity       int    `json:"arity"`
		Description string `json:"description"`
		Example     string `json:"example"`
	}
	out := make([]publicOp, 0, len(operations))
	for _, op := range operations {
		out = append(out, publicOp{op.Name, op.Method, op.Path, op.Arity, op.Description, op.Example})
	}
	writeJSON(w, http.StatusOK, map[string]any{"operations": out})
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// knownRoutes maps every registered path to the methods it accepts. It powers
// the fallback handler's 404-vs-405 decision.
func knownRoutes() map[string][]string {
	routes := map[string][]string{
		"/healthz":           {http.MethodGet},
		"/api/v1/operations": {http.MethodGet},
	}
	for _, op := range operations {
		routes[op.Path] = append(routes[op.Path], op.Method)
	}
	return routes
}

// fallback handles every request the ServeMux did not route to a real handler.
// A request to a known path with an unsupported method gets a 405 (plus an
// Allow header); everything else gets a 404. Both responses are JSON.
func fallback(routes map[string][]string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if methods, ok := routes[r.URL.Path]; ok {
			w.Header().Set("Allow", strings.Join(methods, ", "))
			writeError(w, http.StatusMethodNotAllowed, CodeMethodNotAllowed,
				fmt.Sprintf("method %s is not allowed on %s", r.Method, r.URL.Path))
			return
		}
		writeError(w, http.StatusNotFound, CodeNotFound, "no such endpoint")
	}
}
