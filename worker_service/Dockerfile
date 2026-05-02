# BUILD
FROM golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

# copy go mod FIRST
COPY worker_service/go.mod worker_service/go.sum ./worker_service/
COPY proto_gen/go ./proto_gen/go

WORKDIR /app/worker_service
RUN go mod download

# copy rest
COPY worker_service .

RUN go build -o worker ./cmd/worker/main.go

# RUNTIME
FROM alpine:latest
WORKDIR /app

COPY --from=builder /app/worker_service/worker .

RUN apk add --no-cache ca-certificates

CMD ["./worker"]