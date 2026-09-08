// Command server runs the calculator HTTP microservice.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/tunahanibis/calculator-fullstack/backend/internal/app"
	"github.com/tunahanibis/calculator-fullstack/backend/internal/config"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
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
