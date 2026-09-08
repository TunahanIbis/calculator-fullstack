package httpapi_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/TunahanIbis/calculator-fullstack/backend/internal/httpapi"
)

// newServer spins up the full router (with middleware) on an httptest server.
func newServer(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(httpapi.NewRouter(httpapi.RouterOptions{
		CORSAllowedOrigins: []string{"http://localhost:5173"},
	}))
	t.Cleanup(srv.Close)
	return srv
}

func post(t *testing.T, url, body string) *http.Response {
	t.Helper()
	resp, err := http.Post(url, "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatalf("POST %s: %v", url, err)
	}
	return resp
}

func decode[T any](t *testing.T, resp *http.Response) T {
	t.Helper()
	defer resp.Body.Close()
	var out T
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decoding response: %v", err)
	}
	return out
}

type successBody struct {
	Operation string   `json:"operation"`
	A         float64  `json:"a"`
	B         *float64 `json:"b"`
	Result    float64  `json:"result"`
}

type errorBody struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func TestOperations_Success(t *testing.T) {
	srv := newServer(t)

	tests := []struct {
		path string
		body string
		want float64
	}{
		{"/api/v1/add", `{"a": 2, "b": 3}`, 5},
		{"/api/v1/subtract", `{"a": 10, "b": 4}`, 6},
		{"/api/v1/multiply", `{"a": 6, "b": 7}`, 42},
		{"/api/v1/divide", `{"a": 9, "b": 3}`, 3},
		{"/api/v1/power", `{"a": 2, "b": 10}`, 1024},
		{"/api/v1/sqrt", `{"a": 144}`, 12},
		{"/api/v1/percentage", `{"a": 15, "b": 200}`, 30},
	}

	for _, tc := range tests {
		t.Run(tc.path, func(t *testing.T) {
			resp := post(t, srv.URL+tc.path, tc.body)
			if resp.StatusCode != http.StatusOK {
				t.Fatalf("status = %d, want 200", resp.StatusCode)
			}
			got := decode[successBody](t, resp)
			if got.Result != tc.want {
				t.Fatalf("result = %v, want %v", got.Result, tc.want)
			}
		})
	}
}

func TestDivideByZero(t *testing.T) {
	srv := newServer(t)
	resp := post(t, srv.URL+"/api/v1/divide", `{"a": 1, "b": 0}`)

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", resp.StatusCode)
	}
	body := decode[errorBody](t, resp)
	if body.Error.Code != "DIVISION_BY_ZERO" {
		t.Fatalf("code = %q, want DIVISION_BY_ZERO", body.Error.Code)
	}
}

func TestNegativeSqrt(t *testing.T) {
	srv := newServer(t)
	resp := post(t, srv.URL+"/api/v1/sqrt", `{"a": -4}`)

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", resp.StatusCode)
	}
	if body := decode[errorBody](t, resp); body.Error.Code != "NEGATIVE_SQRT" {
		t.Fatalf("code = %q, want NEGATIVE_SQRT", body.Error.Code)
	}
}

func TestNonFiniteResult(t *testing.T) {
	srv := newServer(t)
	resp := post(t, srv.URL+"/api/v1/power", `{"a": 10, "b": 400}`) // overflows float64

	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", resp.StatusCode)
	}
	if body := decode[errorBody](t, resp); body.Error.Code != "NON_FINITE_NUMBER" {
		t.Fatalf("code = %q, want NON_FINITE_NUMBER", body.Error.Code)
	}
}

func TestValidationErrors(t *testing.T) {
	srv := newServer(t)

	tests := []struct {
		name       string
		path       string
		body       string
		wantStatus int
		wantCode   string
	}{
		{"missing b", "/api/v1/add", `{"a": 1}`, http.StatusUnprocessableEntity, "VALIDATION_ERROR"},
		{"missing a", "/api/v1/add", `{"b": 1}`, http.StatusUnprocessableEntity, "VALIDATION_ERROR"},
		{"empty body", "/api/v1/add", ``, http.StatusBadRequest, "INVALID_JSON"},
		{"malformed json", "/api/v1/add", `{"a": 1,`, http.StatusBadRequest, "INVALID_JSON"},
		{"wrong type", "/api/v1/add", `{"a": "x", "b": 2}`, http.StatusBadRequest, "INVALID_JSON"},
		{"unknown field", "/api/v1/add", `{"a": 1, "b": 2, "c": 3}`, http.StatusBadRequest, "INVALID_JSON"},
		{"trailing object", "/api/v1/add", `{"a": 1, "b": 2}{"a": 1}`, http.StatusBadRequest, "INVALID_JSON"},
		{"b sent to unary", "/api/v1/sqrt", `{"a": 4, "b": 2}`, http.StatusUnprocessableEntity, "VALIDATION_ERROR"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			resp := post(t, srv.URL+tc.path, tc.body)
			if resp.StatusCode != tc.wantStatus {
				t.Fatalf("status = %d, want %d", resp.StatusCode, tc.wantStatus)
			}
			if body := decode[errorBody](t, resp); body.Error.Code != tc.wantCode {
				t.Fatalf("code = %q, want %q", body.Error.Code, tc.wantCode)
			}
		})
	}
}

func TestMethodNotAllowed(t *testing.T) {
	srv := newServer(t)
	resp, err := http.Get(srv.URL + "/api/v1/add")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", resp.StatusCode)
	}
}

func TestUnknownRoute(t *testing.T) {
	srv := newServer(t)
	resp, err := http.Get(srv.URL + "/api/v1/nope")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", resp.StatusCode)
	}
	if body := decode[errorBody](t, resp); body.Error.Code != "NOT_FOUND" {
		t.Fatalf("code = %q, want NOT_FOUND", body.Error.Code)
	}
}

func TestHealth(t *testing.T) {
	srv := newServer(t)
	resp, err := http.Get(srv.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	body := decode[map[string]string](t, resp)
	if body["status"] != "ok" {
		t.Fatalf("status field = %q, want ok", body["status"])
	}
}

func TestListOperations(t *testing.T) {
	srv := newServer(t)
	resp, err := http.Get(srv.URL + "/api/v1/operations")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	body := decode[map[string][]map[string]any](t, resp)
	ops := body["operations"]
	if len(ops) != 7 {
		t.Fatalf("got %d operations, want 7", len(ops))
	}
}

func TestCORSHeaders(t *testing.T) {
	srv := newServer(t)

	req, _ := http.NewRequest(http.MethodOptions, srv.URL+"/api/v1/add", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("preflight status = %d, want 204", resp.StatusCode)
	}
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("Allow-Origin = %q", got)
	}
}

func TestCORS_DisallowedOrigin(t *testing.T) {
	srv := newServer(t)

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/v1/add", strings.NewReader(`{"a":1,"b":2}`))
	req.Header.Set("Origin", "http://evil.example")
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("Allow-Origin = %q, want empty for disallowed origin", got)
	}
	// The request itself still succeeds; CORS is a browser-enforced policy.
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
}

func TestRequestBodyTooLarge(t *testing.T) {
	srv := newServer(t)
	huge := `{"a": 1, "b": ` + strings.Repeat("9", 4096) + `}`
	resp := post(t, srv.URL+"/api/v1/add", huge)
	defer resp.Body.Close()
	// The body is truncated by the limit reader, producing invalid JSON.
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}
