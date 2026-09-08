# Calculator service — developer tasks.
# Every target maps to a plain `go` command; you never need `make` to work on
# this project, it is only a convenience.

BINARY      := bin/server
PKG         := ./...
COVERAGE    := coverage.out

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

.PHONY: run
run: ## Run the service locally (PORT, LOG_LEVEL, CORS_ALLOWED_ORIGINS env vars)
	go run ./cmd/server

.PHONY: build
build: ## Compile a static binary into bin/
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o $(BINARY) ./cmd/server

.PHONY: test
test: ## Run all unit tests with the race detector
	go test -race $(PKG)

.PHONY: cover
cover: ## Run tests and print a per-function coverage report
	go test $(PKG) -covermode=count -coverprofile=$(COVERAGE)
	go tool cover -func=$(COVERAGE)

.PHONY: cover-html
cover-html: cover ## Open the HTML coverage report in a browser
	go tool cover -html=$(COVERAGE)

.PHONY: lint
lint: ## Static analysis: gofmt + go vet
	@test -z "$$(gofmt -l .)" || (echo "gofmt needs to run on:"; gofmt -l .; exit 1)
	go vet $(PKG)

.PHONY: tidy
tidy: ## Verify go.mod / go.sum are tidy
	go mod tidy
	git diff --exit-code go.mod go.sum

.PHONY: docker-build
docker-build: ## Build the container image
	docker build -t calculator-service:local .

.PHONY: clean
clean: ## Remove build and coverage artefacts
	rm -rf bin $(COVERAGE)
