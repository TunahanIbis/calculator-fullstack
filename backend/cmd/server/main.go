// Command server runs the calculator HTTP microservice.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/TunahanIbis/calculator-fullstack/backend/internal/app"
	"github.com/TunahanIbis/calculator-fullstack/backend/internal/config"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}

	// `server healthcheck` probes a running instance and exits; used as the
	// container HEALTHCHECK so the distroless image needs no extra tooling.
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		if err := app.Healthcheck(cfg.Port); err != nil {
			fmt.Fprintln(os.Stderr, "healthcheck failed:", err)
			os.Exit(1)
		}
		return
	}

	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: cfg.LogLevel,
	})))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := app.Run(ctx, app.NewServer(cfg), cfg.ShutdownTimeout); err != nil {
		slog.Error("server terminated with error", "error", err)
		os.Exit(1)
	}
}
