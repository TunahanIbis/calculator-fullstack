package config_test

import (
	"log/slog"
	"testing"
	"time"

	"github.com/tunahanibis/calculator-fullstack/backend/internal/config"
)

func TestLoad_Defaults(t *testing.T) {
	// t.Setenv guarantees a clean, restored environment per test.
	for _, k := range []string{
		"PORT", "CORS_ALLOWED_ORIGINS", "READ_TIMEOUT",
		"WRITE_TIMEOUT", "SHUTDOWN_TIMEOUT", "LOG_LEVEL",
	} {
		t.Setenv(k, "")
	}

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Port != "8080" {
		t.Errorf("Port = %q, want 8080", cfg.Port)
	}
	if cfg.ReadTimeout != 5*time.Second {
		t.Errorf("ReadTimeout = %v, want 5s", cfg.ReadTimeout)
	}
	if cfg.LogLevel != slog.LevelInfo {
		t.Errorf("LogLevel = %v, want info", cfg.LogLevel)
	}
	if len(cfg.CORSAllowedOrigins) != 1 || cfg.CORSAllowedOrigins[0] != "http://localhost:5173" {
		t.Errorf("CORSAllowedOrigins = %v", cfg.CORSAllowedOrigins)
	}
}

func TestLoad_Overrides(t *testing.T) {
	t.Setenv("PORT", "9000")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://a.example, https://b.example")
	t.Setenv("READ_TIMEOUT", "1s")
	t.Setenv("WRITE_TIMEOUT", "2s")
	t.Setenv("SHUTDOWN_TIMEOUT", "3s")
	t.Setenv("LOG_LEVEL", "warn")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Port != "9000" {
		t.Errorf("Port = %q", cfg.Port)
	}
	if len(cfg.CORSAllowedOrigins) != 2 {
		t.Errorf("CORSAllowedOrigins = %v, want 2 entries", cfg.CORSAllowedOrigins)
	}
	if cfg.WriteTimeout != 2*time.Second {
		t.Errorf("WriteTimeout = %v", cfg.WriteTimeout)
	}
	if cfg.LogLevel != slog.LevelWarn {
		t.Errorf("LogLevel = %v, want warn", cfg.LogLevel)
	}
}

func TestLoad_LogLevelAliases(t *testing.T) {
	cases := map[string]slog.Level{
		"debug":   slog.LevelDebug,
		"info":    slog.LevelInfo,
		"warning": slog.LevelWarn,
		"error":   slog.LevelError,
	}
	for in, want := range cases {
		t.Run(in, func(t *testing.T) {
			t.Setenv("LOG_LEVEL", in)
			cfg, err := config.Load()
			if err != nil {
				t.Fatal(err)
			}
			if cfg.LogLevel != want {
				t.Fatalf("LogLevel = %v, want %v", cfg.LogLevel, want)
			}
		})
	}
}

func TestLoad_InvalidValues(t *testing.T) {
	tests := []struct {
		key, val string
	}{
		{"READ_TIMEOUT", "not-a-duration"},
		{"LOG_LEVEL", "verbose"},
	}
	for _, tc := range tests {
		t.Run(tc.key, func(t *testing.T) {
			t.Setenv(tc.key, tc.val)
			if _, err := config.Load(); err == nil {
				t.Fatalf("expected an error for %s=%q", tc.key, tc.val)
			}
		})
	}
}
