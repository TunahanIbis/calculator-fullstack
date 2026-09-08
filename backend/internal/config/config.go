// Package config loads runtime configuration from environment variables,
// applying sensible defaults so the service runs with zero configuration in
// development.
package config

import (
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"
)

// Config is the resolved configuration for the service.
type Config struct {
	Port               string
	CORSAllowedOrigins []string
	ReadTimeout        time.Duration
	WriteTimeout       time.Duration
	ShutdownTimeout    time.Duration
	LogLevel           slog.Level
}

// Load reads configuration from the environment. It returns an error only when
// a variable is set but cannot be parsed; unset variables fall back to defaults.
//
// Recognised variables:
//
//	PORT                  TCP port to listen on              (default 8080)
//	CORS_ALLOWED_ORIGINS  comma-separated origin allow-list  (default http://localhost:5173)
//	READ_TIMEOUT          HTTP read timeout                  (default 5s)
//	WRITE_TIMEOUT         HTTP write timeout                 (default 10s)
//	SHUTDOWN_TIMEOUT      graceful shutdown grace period     (default 10s)
//	LOG_LEVEL             debug|info|warn|error              (default info)
func Load() (Config, error) {
	cfg := Config{
		Port:               getString("PORT", "8080"),
		CORSAllowedOrigins: getCSV("CORS_ALLOWED_ORIGINS", []string{"http://localhost:5173"}),
	}

	var err error
	if cfg.ReadTimeout, err = getDuration("READ_TIMEOUT", 5*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.WriteTimeout, err = getDuration("WRITE_TIMEOUT", 10*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.ShutdownTimeout, err = getDuration("SHUTDOWN_TIMEOUT", 10*time.Second); err != nil {
		return Config{}, err
	}
	if cfg.LogLevel, err = getLogLevel("LOG_LEVEL", slog.LevelInfo); err != nil {
		return Config{}, err
	}

	return cfg, nil
}

func getString(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func getCSV(key string, def []string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return def
	}
	return out
}

func getDuration(key string, def time.Duration) (time.Duration, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return def, nil
	}
	d, err := time.ParseDuration(raw)
	if err != nil {
		return 0, fmt.Errorf("invalid %s: %w", key, err)
	}
	return d, nil
}

func getLogLevel(key string, def slog.Level) (slog.Level, error) {
	raw := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	switch raw {
	case "":
		return def, nil
	case "debug":
		return slog.LevelDebug, nil
	case "info":
		return slog.LevelInfo, nil
	case "warn", "warning":
		return slog.LevelWarn, nil
	case "error":
		return slog.LevelError, nil
	default:
		return 0, fmt.Errorf("invalid %s: %q (want debug|info|warn|error)", key, raw)
	}
}
