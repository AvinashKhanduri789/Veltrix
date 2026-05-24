# Veltrix Local Setup Guide

This guide explains how to run the complete Veltrix distributed system locally from the `main` branch.

Veltrix uses Docker Compose for the backend infrastructure and services. MongoDB is expected to run on MongoDB Atlas through `MONGO_URI`.

Commands in this guide are written for Windows PowerShell unless a Command Prompt alternative is shown.

## 1. Required Tools

Install these first:

- Git: https://git-scm.com/downloads
- Docker Desktop: https://docs.docker.com/get-started/introduction/get-docker-desktop/
- Node.js 20 or newer: https://nodejs.org/en/download

npm is included with the standard Node.js installer.

Required for regenerating Go protobuf code:

- Protocol Buffers compiler (`protoc`)
- Go protobuf plugin (`protoc-gen-go`)
- Go gRPC plugin (`protoc-gen-go-grpc`)

Verify the tools:

```powershell
git --version
docker --version
docker compose version
```

Optional frontend verification:

```powershell
node --version
npm --version
```

Optional protobuf verification:

```powershell
protoc --version
protoc-gen-go --version
protoc-gen-go-grpc --version
```

## 2. Clone The Repository

```powershell
git clone <your-repository-url>
cd Veltrix
```

If the repository already exists locally:

```powershell
cd D:\projects\Veltrix
```

## 3. Use The Main Branch

The `main` branch is the complete local distributed architecture.

```powershell
git switch main
git pull origin main
git status
```

Expected branch:

```text
On branch main
```

If `git status` shows local changes, decide whether to commit, stash, or discard them before continuing. Do not mix demo-branch changes into the local production setup.

## 4. Configure MongoDB Atlas

Veltrix stores users, functions, versions, and execution metadata in MongoDB.

Create or use an existing MongoDB Atlas cluster:

1. Open MongoDB Atlas.
2. Create a project and cluster if you do not already have one.
3. Create a database user under Database Access.
4. Allow your machine IP under Network Access.
5. Open Connect.
6. Choose Drivers.
7. Copy the connection string.

The URI usually looks like this:

```text
mongodb+srv://<username>:<password>@<cluster-host>/veltrix?retryWrites=true&w=majority
```

Replace:

- `<username>` with your Atlas database username
- `<password>` with your Atlas database password
- `<cluster-host>` with your Atlas cluster host

Keep `/veltrix` in the URI so the application uses the `veltrix` database.

## 5. Create The Root Environment File

Docker Compose reads variables from a `.env` file in the project root.

Create this file:

```powershell
notepad .env
```

Add:

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-host>/veltrix?retryWrites=true&w=majority
```

Save the file.

Do not commit `.env` to Git.

## 6. Understand The Docker Compose Setup

The root `docker-compose.yml` starts the distributed system:

- Kafka
- Redis
- MinIO
- Python runtime container
- Node runtime container
- Worker service
- Scheduler service
- API Gateway
- Logs service

MongoDB is not started by Docker Compose because the project uses MongoDB Atlas through `MONGO_URI`.

## 7. Generate Go Protobuf Code

Generated Go protobuf code is not committed to Git. You must generate it locally before building or running the Go services.

Only Go code generation is required for this project setup.

Install `protoc` from the official Protocol Buffers installation guide:

```text
https://protobuf.dev/installation/
```

Install the Go protobuf plugins if they are not installed:

```powershell
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
```

Make sure your Go bin directory is available on `PATH`. On Windows this is usually:

```text
%USERPROFILE%\go\bin
```

From the project root, generate all Go protobuf files:

```powershell
New-Item -ItemType Directory -Force proto_gen/go

protoc -I proto --go_out=proto_gen/go --go_opt=paths=import,module=veltrix/proto --go-grpc_out=proto_gen/go --go-grpc_opt=paths=import,module=veltrix/proto proto/scheduler.proto proto/logs.proto proto/runtime_execution.proto

protoc -I proto --go_out=proto_gen/go --go_opt=paths=import,module=veltrix/proto proto/events/execution_job.proto proto/events/execution_event.proto proto/events/execution_log.proto
```

Create the Go module file for generated code:

```powershell
@"
module veltrix/proto

go 1.24.0
"@ | Set-Content -Encoding ascii proto_gen/go/go.mod
```

You can also use the existing helper scripts, which run the same Go protobuf generation flow.

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate_protos.ps1
```

Linux/macOS or Git Bash:

```bash
bash scripts/generate_protos.sh
```

Expected output folder:

```text
proto_gen/go
```

## 8. Build And Start The System

From the project root:

```powershell
docker compose up -d --build
```

Use this when:

- running for the first time
- Dockerfiles changed
- service dependencies changed
- you want a fresh image build

If images are already built and you only want to start containers:

```powershell
docker compose up -d
```

Check running containers:

```powershell
docker compose ps
```

Watch logs:

```powershell
docker compose logs -f
```

Watch one service:

```powershell
docker compose logs -f gateway
docker compose logs -f scheduler
docker compose logs -f worker
docker compose logs -f logs-service
```

## 9. Create The MinIO Bucket

Function uploads are stored in MinIO. The Gateway expects this bucket:

```text
code-bucket
```

Open the MinIO console:

```text
http://localhost:9001
```

Login:

```text
Username: minioadmin
Password: minioadmin
```

Create a bucket named:

```text
code-bucket
```

You only need to create it once for the local Docker volume.

## 10. Run The React Client

The backend API Gateway runs on:

```text
http://localhost:8080
```

The React client runs separately with Vite.

Open a new terminal:

```powershell
cd D:\projects\Veltrix\Veltrix_client
npm install
$env:VITE_API_URL="http://localhost:8080"
npm run dev
```

If you are using Command Prompt instead of PowerShell:

```cmd
cd /d D:\projects\Veltrix\Veltrix_client
npm install
set VITE_API_URL=http://localhost:8080
npm run dev
```

Open:

```text
http://localhost:5173
```

Important port meaning:

- `localhost:5173` is the React frontend
- `localhost:8080` is the API Gateway backend
- `localhost:9001` is the MinIO console

## 11. API Smoke Checks

The default Docker Compose setup currently has:

```env
DISABLE_AUTH=true
```

That means protected API routes use a development user inside the Gateway middleware.

Gateway base URL:

```powershell
$env:BASE_URL="http://localhost:8080"
```

Health-style route check:

```powershell
curl http://localhost:8080/functions
```

Expected result is a JSON response from the Gateway. If you see `Route not found` at `/`, that only means the Gateway has no homepage route. Use the frontend at `http://localhost:5173`.

## 12. Functional Local Test

After Docker services and the React client are running:

1. Open `http://localhost:5173`.
2. Upload a Python or Node function.
3. Confirm the function appears in the functions list.
4. Trigger execution.
5. Watch execution history.
6. Open execution details.
7. Inspect logs/results.

This validates:

- Gateway to Scheduler gRPC path
- Scheduler to Kafka job publishing
- Worker job consumption
- Redis/MinIO code retrieval path
- runtime container execution
- Kafka execution event flow
- logs service streaming path
- MongoDB Atlas persistence

## 13. Stopping The System

Stop containers but keep local volumes:

```powershell
docker compose down
```

Stop containers and remove local volumes:

```powershell
docker compose down -v
```

Use `-v` only when you intentionally want to delete local Kafka, Redis, and MinIO data.

## 14. Common Issues

### Opening localhost:8080 shows Route not found

That is expected if you open:

```text
http://localhost:8080/
```

`8080` is the API Gateway, not the React frontend.

Open the frontend instead:

```text
http://localhost:5173
```

### Gateway cannot connect to MongoDB

Check:

- `.env` exists in the project root
- `MONGO_URI` is correct
- Atlas database user and password are correct
- your IP is allowed in Atlas Network Access
- the URI includes `/veltrix`

Restart after changing `.env`:

```powershell
docker compose down
docker compose up -d --build
```

### Go services fail with missing veltrix/proto package

Generate Go protobuf code again:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate_protos.ps1
```

Confirm this folder exists:

```text
proto_gen/go
```

### Function upload fails

Check:

- MinIO is running
- `code-bucket` exists
- Gateway has these values from `docker-compose.yml`:
  - `MINIO_ENDPOINT=minio`
  - `MINIO_PORT=9000`
  - `MINIO_ACCESS_KEY=minioadmin`
  - `MINIO_SECRET_KEY=minioadmin`
  - `MINIO_BUCKET=code-bucket`

### Frontend cannot call backend

Check the Vite env variable:

```powershell
$env:VITE_API_URL="http://localhost:8080"
npm run dev
```

Also confirm the Gateway container is running:

```powershell
docker compose ps gateway
```

### Rebuild after code changes

For backend/container changes:

```powershell
docker compose up -d --build
```

For frontend changes:

```powershell
cd Veltrix_client
npm run dev
```

## 15. Useful URLs

- Frontend: `http://localhost:5173`
- API Gateway: `http://localhost:8080`
- MinIO Console: `http://localhost:9001`
- Kafka internal broker: `kafka:9092`
- Redis internal address: `redis:6379`
- Scheduler internal gRPC: `scheduler:50051`
- Logs service internal gRPC: `logs-service:50053`

## 16. Main Branch Reminder

Use `main` for the full local distributed architecture.

Use demo-specific branches only for public lightweight deployments where execution may be disabled.
