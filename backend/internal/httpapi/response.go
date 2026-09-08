package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// ErrorCode is a stable, machine-readable identifier for a class of error.
// Clients should branch on this rather than on the human-readable message.
type ErrorCode string

const (
	CodeInvalidJSON      ErrorCode = "INVALID_JSON"
	CodeValidation       ErrorCode = "VALIDATION_ERROR"
	CodeDivisionByZero   ErrorCode = "DIVISION_BY_ZERO"
	CodeNegativeSqrt     ErrorCode = "NEGATIVE_SQRT"
	CodeNonFinite        ErrorCode = "NON_FINITE_NUMBER"
	CodeNotFound         ErrorCode = "NOT_FOUND"
	CodeMethodNotAllowed ErrorCode = "METHOD_NOT_ALLOWED"
	CodeInternal         ErrorCode = "INTERNAL_ERROR"
)

// apiError is the body of every non-2xx response.
type apiError struct {
	Error errorDetail `json:"error"`
}

type errorDetail struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
}

// writeJSON serialises payload as JSON with the given status code.
func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		// The status line is already flushed at this point, so all we can do
		// is record it for operators.
		slog.Error("failed to encode response body", "error", err)
	}
}

// writeError sends a structured error envelope.
func writeError(w http.ResponseWriter, status int, code ErrorCode, message string) {
	writeJSON(w, status, apiError{Error: errorDetail{Code: code, Message: message}})
}
