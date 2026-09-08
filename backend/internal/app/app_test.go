package app_test

import (
	"context"
	"io"
	"net"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/tunahanibis/calculator-fullstack/backend/internal/app"
	"github.com/tunahanibis/calculator-fullstack/backend/internal/config"
)

func TestNewServer_ServesHealthz(t *testing.T) {
	srv := app.NewServer(config.Config{Port: "0", CORSAllowedOrigins: []string{"*"}})

	req, _ := http.NewRequest(http.MethodGet, "/healthz", nil)
	rec := &recorder{header: http.Header{}}
	srv.Handler.ServeHTTP(rec, req)

	if rec.status != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.status)
	}
}

func TestRun_GracefulShutdownOnContextCancel(t *testing.T) {
	srv := app.NewServer(config.Config{Port: "0"})
	srv.Addr = "127.0.0.1:0" // let the OS pick a free port

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- app.Run(ctx, srv, time.Second) }()

	// Give the listener a moment to come up, then ask it to stop.
	time.Sleep(50 * time.Millisecond)
	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("Run returned error on graceful shutdown: %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("Run did not return within 3s of context cancellation")
	}
}

func TestRun_ReturnsErrorWhenListenFails(t *testing.T) {
	srv := app.NewServer(config.Config{Port: "0"})
	srv.Addr = "127.0.0.1:70000" // invalid port -> ListenAndServe fails fast

	err := app.Run(context.Background(), srv, time.Second)
	if err == nil {
		t.Fatal("expected an error when the server cannot bind its address")
	}
}

func TestHealthcheck(t *testing.T) {
	// Bring a real server up on an ephemeral port.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := strconv.Itoa(ln.Addr().(*net.TCPAddr).Port)
	_ = ln.Close()

	srv := app.NewServer(config.Config{Port: port})
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { _ = app.Run(ctx, srv, time.Second); close(done) }()
	t.Cleanup(func() { cancel(); <-done })

	// Wait for it to accept connections.
	deadline := time.Now().Add(3 * time.Second)
	for {
		if err := app.Healthcheck(port); err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("server did not become healthy in time")
		}
		time.Sleep(20 * time.Millisecond)
	}

	// A port with nothing listening must fail.
	if err := app.Healthcheck("1"); err == nil {
		t.Fatal("expected Healthcheck to fail against a closed port")
	}
}

// recorder is a tiny http.ResponseWriter for handler assertions without
// importing httptest into this package's test.
type recorder struct {
	header http.Header
	status int
}

func (r *recorder) Header() http.Header { return r.header }
func (r *recorder) Write(b []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	return io.Discard.Write(b)
}
func (r *recorder) WriteHeader(status int) { r.status = status }
