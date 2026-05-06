const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { executeNode } = require("./executor");

const PROTO_PATH = path.join(__dirname, "../proto/runtime_execution.proto");

const packageDef = protoLoader.loadSync(PROTO_PATH);
const proto = grpc.loadPackageDefinition(packageDef).veltrix.runtime;

function createWorkdir() {
  const dir = fs.mkdtempSync(path.join("/tmp/", "exec_"));
  fs.chmodSync(dir, 0o700);
  return dir;
}

function cleanupWorkdir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

async function ExecuteExecution(call) {
  for await (const req of call) {
    if (!req.start) continue;

    const start = req.start;
    const workdir = createWorkdir();

    try {
      const result = await executeNode(
        start.codeBundle,
        start.timeoutSeconds,
        workdir,
        {
          sendLog: (msg) => {
            call.write({
              log: {
                executionId: start.executionId,
                message: msg,
                type: 0,
                timestamp: Date.now().toString()
              }
            });
          }
        }
      );

      if (result.error === "timeout") {
        call.write({
          result: {
            executionId: start.executionId,
            status: "EXECUTION_TIMEOUT",
            exitCode: -1,
            output: "",
            errorMessage: "timeout"
          }
        });
      } else {
        call.write({
          result: {
            executionId: start.executionId,
            status: result.exitCode === 0 ? "EXECUTION_SUCCESS" : "EXECUTION_FAILED",
            exitCode: result.exitCode,
            output: "",
            errorMessage: result.exitCode === 0 ? "" : "runtime error"
          }
        });
      }

    } catch (err) {
      call.write({
        result: {
          executionId: start.executionId,
          status: "EXECUTION_FAILED",
          exitCode: -1,
          output: "",
          errorMessage: err.message
        }
      });
    } finally {
      cleanupWorkdir(workdir);
    }
  }

  call.end();
}

function main() {
  const server = new grpc.Server();
  server.addService(proto.RuntimeExecutionService.service, {
    ExecuteExecution
  });

  server.bindAsync("0.0.0.0:50052", grpc.ServerCredentials.createInsecure(), () => {
    console.log("🚀 Node runtime started on 50052");
    server.start();
  });
}

main();