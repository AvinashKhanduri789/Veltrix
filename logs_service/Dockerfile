# =========================
# BUILD STAGE
# =========================
FROM golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

# go mod cache
COPY logs_service/go.mod logs_service/go.sum ./logs_service/
COPY proto_gen/go ./proto_gen/go

WORKDIR /app/logs_service
RUN go mod download

# copy code
COPY logs_service ./

RUN go build -o logs-service ./cmd/logs/main.go

# =========================
# RUNTIME STAGE
# =========================
FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/logs_service/logs-service .

EXPOSE 50053

CMD ["./logs-service"]