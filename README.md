# Veltrix

Veltrix is a distributed, event-driven execution platform for running short-lived user functions at scale with strong isolation and high concurrency.

The platform supports:
- function upload and version management
- trigger execution
- replay execution
- cancel execution
- real-time log streaming

Veltrix is built as an infrastructure engineering project inspired by serverless and worker-based systems. The focus is on distributed systems design, control-plane/data-plane separation, event-driven communication, and runtime isolation.

## DEMO DEPLOYMENT NOTE

This public deployment is a lightweight showcase version of Veltrix.

The complete distributed infrastructure including Kafka, Scheduler, Worker Services, Runtime Containers, and orchestration pipelines was fully implemented and tested locally.

Because the full infrastructure requires significant cloud resources, live execution features are disabled in the public demo deployment.

However, the complete architecture and implementation remain available in the source code repository.

The `main` branch preserves the complete distributed execution platform. The `demo-deployment` branch keeps the same source code and adds a transparent demo gate around infrastructure-heavy execution actions. Function upload, function browsing, execution history, execution details, persisted results, and architecture review surfaces remain available for project review, copyright proof, portfolio showcase, and recruiter demonstration.

When `DEMO_MODE=true` is set on the Gateway, execution mutation endpoints return HTTP 503 with:

```json
{
  "message": "Execution infrastructure is disabled in the public demo deployment."
}
```

This does not remove the execution APIs or distributed services. It prevents the public hosted version from attempting scheduler orchestration, Kafka processing, worker execution, or runtime container spawning without the full local infrastructure.

## Architecture

![Veltrix System Architecture](./architecture_digrams/ArchitectureDigram(system%20design).png)

## Design Principles

### 1. Control Plane vs Data Plane

Control Plane:
- API Gateway
- Scheduler Service

Responsibilities:
- request validation and orchestration
- execution lifecycle management
- metadata persistence
- scheduling and dispatch decisions

Data Plane:
- Worker Service
- Runtime Containers (Python / Node / Go)

Responsibilities:
- execution processing
- process spawning and isolation
- log capture and streaming
- final execution result production

### 2. Event-Driven Communication

Kafka is the event backbone connecting services asynchronously and enabling decoupled scaling.

### 3. Runtime Isolation

User code executes in isolated child processes inside language runtime containers, not inside control-plane services.

## High-Level Flow

Client
-> API Gateway
-> Scheduler Service
-> Kafka (execution-jobs)
-> Worker Service
-> Runtime Containers
-> Kafka (execution-events + execution-logs)
-> Logs Service
-> API Gateway (SSE)
-> Client

Supporting systems:
- MongoDB for metadata/state
- MinIO for code storage
- Redis for worker-side code cache

In the demo deployment, the frontend still exposes the architecture page at `/architecture` and clearly labels the app as demo mode. The backend keeps read-side execution endpoints available so previous execution records, outputs, and logs can be inspected.

## Core Services

### API Gateway (Node.js)

Responsibilities:
- REST API surface
- auth and validation
- function and execution endpoints
- gRPC client calls to Scheduler and Logs services
- SSE bridge for log streaming

Gateway never executes user code.

### Scheduler Service (Go)

Responsibilities:
- accept execution commands from Gateway
- create execution records in MongoDB
- publish execution jobs to Kafka
- process replay/cancel requests
- consume execution lifecycle events and update execution state

Scheduler is control-plane orchestration only.

### Worker Service (Go)

Responsibilities:
- consume execution jobs from Kafka
- coordinate execution lifecycle with worker pool goroutines
- retrieve code from Redis/MinIO
- stream runtime logs
- publish execution events and logs to Kafka

Worker orchestrates execution but does not run user code directly.

### Logs Service (Go)

Responsibilities:
- consume execution logs stream/events
- provide gRPC log stream per execution
- support Gateway SSE bridge to clients

### Runtime Containers (Python / Node / Go)

Responsibilities:
- receive execution requests over gRPC
- spawn isolated child processes
- enforce runtime limits
- stream stdout/stderr
- return final result
- cleanup execution artifacts

## Kafka Topics

- `execution-jobs`: Scheduler -> Worker
- `execution-events`: Worker -> Scheduler
- `execution-logs`: Worker -> Logs Service

This model enables async scheduling, service decoupling, and horizontal scale.

## Execution Lifecycle

1. User triggers execution via Gateway.
2. Scheduler creates execution record (MongoDB).
3. Scheduler publishes job (`execution-jobs`).
4. Worker consumes job and prepares execution snapshot.
5. Worker invokes runtime container over gRPC stream.
6. Runtime executes in isolated child process.
7. Logs stream back and are published to Kafka.
8. Worker publishes lifecycle event.
9. Scheduler consumes event and updates execution state.
10. Logs are streamed to client through Logs Service -> Gateway SSE.

## Concurrency Model

### Worker-Level Concurrency

Each worker instance processes jobs via a goroutine pool.

### Runtime-Level Concurrency

Each execution runs as an OS process inside runtime containers.

This two-layer approach provides throughput and isolation together.

## Isolation and Security

Execution safety model includes:
- non-root runtime containers
- execution timeout controls
- CPU and memory limits
- process count limits
- isolated working directories
- process group termination
- bounded log output
- temporary file cleanup

## Scalability Strategy

### Horizontal Scale

Add more worker service instances. Kafka partitions distribute jobs across consumers.

### Vertical Scale

Increase worker pool size per worker instance to raise parallelism.

## Current Direction

Veltrix is focused on building a robust execution infrastructure, not just a code runner. The project emphasizes:
- distributed control-plane reliability
- event-driven consistency
- runtime process isolation
- high-concurrency execution pipelines

## Future Enhancements

- advanced sandboxing
- retry policies and DLQs
- resource-aware scheduling
- per-runtime worker pools
- metrics and observability
- distributed tracing
- autoscaling
- multi-tenant quotas

## Local Run Checklist

Use this checklist to start Veltrix locally in a stable order.

1. Start infrastructure services:
- MongoDB
- Kafka (+ Zookeeper if your setup needs it)
- MinIO
- Redis

2. Confirm scheduler env is configured:
- `scheduler_service/.env`
- required keys:
  - `SCHEDULER_GRPC_PORT`
  - `MONGO_URI`
  - `MONGO_DB_NAME`
  - `KAFKA_BROKERS`
  - `KAFKA_TOPIC`

3. Generate Go protobufs:
- from repo root: `make protos`
- output should exist under `proto_gen/go`

4. Install dependencies per service:
- `gateway_service` -> `npm install`
- `scheduler_service` -> `go mod tidy` (if needed)
- `logs_service` -> `go mod tidy` (if needed)

5. Start services:
- Scheduler Service (Go)
- Logs Service (Go)
- API Gateway (Node.js)
- Worker Service (Go) when worker flow is ready

6. Verify control-plane connectivity:
- Gateway can call Scheduler gRPC (`SCHEDULER_GRPC_ADDR`)
- Gateway can stream logs from Logs gRPC (`LOGS_GRPC_ADDR`)

7. Run functional smoke checks:
- register/login
- create function + upload code
- trigger execution
- replay execution
- cancel execution
- stream logs over SSE

8. Validate event pipeline:
- `execution-jobs` receives scheduler jobs
- `execution-events` updates scheduler execution states
- `execution-logs` feeds logs service streams

## Demo Deployment Run

The lightweight demo compose file starts only the local services needed for hosted review of the Gateway-backed demo surfaces. MongoDB should still use MongoDB Atlas through `MONGO_URI`.

```bash
docker compose -f docker-compose.demo.yml up -d
```

It intentionally does not start local MongoDB, Kafka, Scheduler, Worker Services, Redis, Logs Service, or Runtime Containers. The full `docker-compose.yml` remains available for the complete distributed local deployment.

Before starting the demo compose file, set your Atlas connection string:

```bash
export MONGO_URI="your-mongodb-atlas-uri"
```

PowerShell:

```powershell
$env:MONGO_URI="your-mongodb-atlas-uri"
```

For a public frontend build, keep demo mode enabled:

```bash
VITE_DEMO_MODE=true npm run build
```

For the Gateway demo deployment, set:

```bash
DEMO_MODE=true
```

Execution trigger, replay, and cancel requests will be disabled cleanly. Function management and read-only execution history endpoints continue to demonstrate persistence and prior local execution records.

## Quick Start (Copy-Paste)

### 1) Infrastructure (Mongo, Kafka, MinIO, Redis)

If your `docker-compose.yml` already defines these services:

```bash
docker compose up -d
```

If you use service-specific names, bring those up accordingly.

### 2) Environment Files

Create/update `scheduler_service/.env`:

```bash
cat > scheduler_service/.env <<'EOF'
SCHEDULER_GRPC_PORT=50051
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=veltrix
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=execution-jobs
EOF
```

Create/update `gateway_service/.env`:

```bash
cat > gateway_service/.env <<'EOF'
PORT=3000
MONGO_URI=mongodb://localhost:27017/veltrix

JWT_ACCESS_SECRET=replace-with-strong-access-secret
JWT_REFRESH_SECRET=replace-with-strong-refresh-secret
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
COOKIE_SECURE=false

SCHEDULER_GRPC_ADDR=localhost:50051
LOGS_GRPC_ADDR=localhost:50052

MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=taskforge-code
MINIO_USE_SSL=false
EOF
```

Optional `logs_service/.env` (if your logs service reads env):

```bash
cat > logs_service/.env <<'EOF'
LOGS_GRPC_PORT=50052
KAFKA_BROKERS=localhost:9092
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=veltrix
EOF
```

### 3) Generate Protos (Go)

From repo root:

```bash
make protos
```

`proto_gen` is not committed to git.  
You must run this before building/running services that import protobuf Go packages.

If `make` is unavailable, use:

```bash
bash scripts/generate_protos.sh
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate_protos.ps1
```

### 4) Install Dependencies

```bash
# gateway
cd gateway_service && npm install && cd ..

# scheduler
cd scheduler_service && go mod tidy && cd ..

# logs
cd logs_service && go mod tidy && cd ..
```

### 5) Run Services

Open separate terminals:

```bash
# terminal 1
cd scheduler_service
go run ./cmd/scheduler
```

```bash
# terminal 2
cd logs_service
go run ./cmd/logs
```

```bash
# terminal 3
cd gateway_service
npm start
```

### 6) API Endpoints

Base URL:

```bash
export BASE_URL=http://localhost:3000
```

Auth:
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Functions:
- `POST /functions`
- `PUT /functions/:id`
- `GET /functions`
- `GET /functions/:id`
- `DELETE /functions/:id`

Executions:
- `POST /executions/:functionId`
- `POST /executions/:executionId/replay`
- `POST /executions/:executionId/cancel`
- `GET /executions/:executionId`
- `GET /executions/function/:functionId`
- `GET /executions/:executionId/logs` (SSE)

### 7) Smoke Test Commands

Register:

```bash
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"user1@example.com","password":"password123","role":"USER"}'
```

Login (stores httpOnly cookies in `cookies.txt`):

```bash
curl -i -c cookies.txt -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user1@example.com","password":"password123"}'
```

Current user:

```bash
curl -b cookies.txt "$BASE_URL/auth/me"
```

Create function (multipart upload):

```bash
curl -b cookies.txt -X POST "$BASE_URL/functions" \
  -F "name=image-resizer" \
  -F "language=python" \
  -F "file=@./sample.py"
```

Trigger execution:

```bash
curl -b cookies.txt -X POST "$BASE_URL/executions/<functionId>" \
  -H "Content-Type: application/json" \
  -d '{"inputPayload":{"hello":"world"}}'
```

Replay execution:

```bash
curl -b cookies.txt -X POST "$BASE_URL/executions/<executionId>/replay" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Cancel execution:

```bash
curl -b cookies.txt -X POST "$BASE_URL/executions/<executionId>/cancel" \
  -H "Content-Type: application/json" \
  -d '{}'
```

SSE logs stream:

```bash
curl -N -b cookies.txt "$BASE_URL/executions/<executionId>/logs"
```
