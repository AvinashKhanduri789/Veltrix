#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROTO_DIR="${ROOT_DIR}/proto"
GO_OUT_DIR="${ROOT_DIR}/proto_gen/go"
NODE_OUT_DIR="${ROOT_DIR}/proto_gen/node"

SCHEDULER_PROTO="${PROTO_DIR}/scheduler.proto"
LOGS_PROTO="${PROTO_DIR}/logs.proto"
RUNTIME_EXECUTION_PROTO="${PROTO_DIR}/runtime_execution.proto"
EVENT_PROTOS=(
  "${PROTO_DIR}/events/execution_job.proto"
  "${PROTO_DIR}/events/execution_event.proto"
  "${PROTO_DIR}/events/execution_log.proto"
)

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

echo "[protos] checking required tools..."
require_cmd protoc
require_cmd protoc-gen-go
require_cmd protoc-gen-go-grpc

echo "[protos] cleaning output folders..."
rm -rf "${GO_OUT_DIR}" "${NODE_OUT_DIR}"
mkdir -p "${GO_OUT_DIR}"

echo "[protos] generating Go protobufs..."
protoc \
  -I "${PROTO_DIR}" \
  --go_out="${GO_OUT_DIR}" \
  --go_opt=paths=import,module=veltrix/proto \
  --go-grpc_out="${GO_OUT_DIR}" \
  --go-grpc_opt=paths=import,module=veltrix/proto \
  "${SCHEDULER_PROTO}" \
  "${LOGS_PROTO}" \
  "${RUNTIME_EXECUTION_PROTO}"

protoc \
  -I "${PROTO_DIR}" \
  --go_out="${GO_OUT_DIR}" \
  --go_opt=paths=import,module=veltrix/proto \
  "${EVENT_PROTOS[@]}"

cat > "${GO_OUT_DIR}/go.mod" <<'EOF'
module veltrix/proto

go 1.24.0
EOF

echo "[protos] generated files:"
echo "  - ${GO_OUT_DIR}"
echo "[protos] done."
