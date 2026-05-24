# Veltrix

Veltrix is a distributed, event-driven execution platform for running short-lived user functions at scale with strong isolation and high concurrency.

The platform supports:
- function upload and version management
- trigger execution
- replay execution
- cancel execution
- real-time log streaming

Veltrix is built as an infrastructure engineering project inspired by serverless and worker-based systems. The focus is on distributed systems design, control-plane/data-plane separation, event-driven communication, and runtime isolation.

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

## Local Setup

For local setup and verification, use the dedicated production-style setup guide:

[SETUP.md](./SETUP.md)

The setup guide covers:
- required tools
- confirming you are on the `main` branch
- MongoDB Atlas connection setup
- Docker Compose build and run commands
- MinIO bucket setup
- frontend startup
- smoke tests and troubleshooting
