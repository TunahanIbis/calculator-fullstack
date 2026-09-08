// Package app wires configuration and the HTTP API into a runnable server with
// graceful shutdown. Keeping this out of package main makes it testable.
package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/TunahanIbis/calculator-fullstack/backend/internal/config"
	"github.com/TunahanIbis/calculator-fullstack/backend/internal/httpapi"
)

// NewServer builds the *http.Server for the given configuration. The handler
// and timeouts are fully configured; the caller is responsible for starting it.
func NewServer(cfg config.Config) *http.Server {
	return &http.Server{
		Addr: ":" + cfg.Port,
		Handler: httpapi.NewRouter(httpapi.RouterOptions{
			CORSAllowedOrigins: cfg.CORSAllowedOrigins,
		}),
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
	}
}

// Run starts srv and blocks until ctx is cancelled or the server fails to
// start. On cancellation it attempts a graceful shutdown bounded by grace,
// returning any shutdown error. A clean shutdown returns nil.
func Run(ctx context.Context, srv *http.Server, grace time.Duration) error {
	serveErr := make(chan error, 1)
	go func() {
		slog.Info("calculator service listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serveErr <- err
		}
	}()

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
		slog.Info("shutdown signal received, draining connections")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), grace)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		return err
	}
	slog.Info("shutdown complete")
	return nil
}

// Healthcheck performs a one-shot GET /healthz against an instance already
// listening on port. It backs the container HEALTHCHECK so the distroless image
// needs no shell, curl or wget: `/server healthcheck` exits 0 when healthy.
func Healthcheck(port string) error {
	client := &http.Client{Timeout: 2 * time.Second}

	resp, err := client.Get("http://127.0.0.1:" + port + "/healthz")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("/healthz returned HTTP %d", resp.StatusCode)
	}
	return nil
}
