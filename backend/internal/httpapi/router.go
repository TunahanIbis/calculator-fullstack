package httpapi

import "net/http"

// RouterOptions configures the behaviour of the HTTP handler.
type RouterOptions struct {
	// CORSAllowedOrigins is the list of browser origins permitted to call the
	// API. Use []string{"*"} to allow any origin.
	CORSAllowedOrigins []string
}

// NewRouter builds the fully wired http.Handler for the calculator service:
// all routes plus the middleware stack (CORS, request logging, panic recovery).
func NewRouter(opts RouterOptions) http.Handler {
	mux := http.NewServeMux()

	// Operational endpoints.
	mux.HandleFunc("GET /healthz", handleHealth)
	mux.HandleFunc("GET /api/v1/operations", handleListOperations)

	// One calculation route per operation, sourced from the operations table.
	for _, op := range operations {
		mux.Handle(op.Method+" "+op.Path, handleOperation(op))
	}

	// Catch-all: a registered subtree pattern ("/") would otherwise let Go's
	// ServeMux answer every unmatched request, including a known path hit with
	// the wrong method. This handler restores a correct, JSON 404 / 405 split.
	mux.HandleFunc("/", fallback(knownRoutes()))

	return chain(mux,
		recoverer,     // outermost: catches panics from everything below
		requestLogger, // log final status + latency
		cors(opts.CORSAllowedOrigins),
	)
}
