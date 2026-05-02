# BUILD
FROM golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

# copy go mod FIRST
COPY scheduler_service/go.mod scheduler_service/go.sum ./scheduler_service/
COPY proto_gen/go ./proto_gen/go

WORKDIR /app/scheduler_service
RUN go mod download

# copy rest
COPY scheduler_service .

RUN go build -o scheduler ./cmd/scheduler/main.go

# RUNTIME
FROM alpine:latest
WORKDIR /app

COPY --from=builder /app/scheduler_service/scheduler .

CMD ["./scheduler"]