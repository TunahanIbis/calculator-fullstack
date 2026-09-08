# syntax=docker/dockerfile:1

# ---- build stage ------------------------------------------------------------
FROM golang:1.23-alpine AS build

WORKDIR /src

# Cache module downloads. There are currently no third-party dependencies, but
# keeping this layer makes adding one cheap.
COPY go.mod ./
RUN go mod download

COPY . .

# Static, stripped binary so the final image can be scratch/distroless.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# ---- test stage (optional: `docker build --target test`) -------------------
FROM build AS test
RUN go vet ./... && go test ./...

# ---- runtime stage --------------------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /
COPY --from=build /out/server /server

EXPOSE 8080
USER nonroot:nonroot

# A HEALTHCHECK is intentionally omitted: distroless has no shell/curl. Rely on
# the orchestrator probing GET /healthz instead (see docker-compose.yml).
ENTRYPOINT ["/server"]
