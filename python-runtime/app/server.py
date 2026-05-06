import grpc
import asyncio
import os
import subprocess
import tempfile
import shutil
import time
import signal
import resource

import runtime_execution_pb2 as pb2
import runtime_execution_pb2_grpc as pb2_grpc


# -------------------------------
# Resource Limits
# -------------------------------
def apply_limits():
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_CPU, (2, 2))
    resource.setrlimit(resource.RLIMIT_NPROC, (10, 10))


# -------------------------------
# Workdir
# -------------------------------
def create_workdir():
    path = tempfile.mkdtemp(prefix="exec_")
    os.chmod(path, 0o700)
    return path


def cleanup_workdir(path):
    shutil.rmtree(path, ignore_errors=True)


# -------------------------------
# Runtime Service
# -------------------------------
class RuntimeService(pb2_grpc.RuntimeExecutionServiceServicer):

    async def ExecuteExecution(self, request_iterator, context):

        async for req in request_iterator:

            if not req.HasField("start"):
                continue

            start = req.start

            workdir = create_workdir()
            file_path = os.path.join(workdir, "main.py")

            collected_output = []
            MAX_OUTPUT_LINES = 1000  # prevent log explosion

            try:
                # Write user code
                with open(file_path, "wb") as f:
                    f.write(start.code_bundle)

                process = subprocess.Popen(
                    ["python", file_path],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    cwd=workdir,
                    bufsize=1,
                    preexec_fn=lambda: (os.setsid(), apply_limits())
                )

                start_time = time.time()

                while True:
                    if process.stdout is None:
                        break

                    line = process.stdout.readline()

                    if line == "" and process.poll() is not None:
                        break

                    if line:
                        line = line.rstrip()

                        if len(collected_output) < MAX_OUTPUT_LINES:
                            collected_output.append(line)

                        yield pb2.ExecutionResponse(
                            log=pb2.ExecutionLog(
                                execution_id=start.execution_id,
                                message=line[:1000],  # truncate
                                type=pb2.STDOUT,
                                timestamp=str(time.time())
                            )
                        )

                    # HARD timeout enforcement
                    if time.time() - start_time > start.timeout_seconds:
                        try:
                            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                            await asyncio.sleep(1)
                            os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                        except Exception:
                            pass
                        raise subprocess.TimeoutExpired(cmd="python", timeout=start.timeout_seconds)

                process.wait()

                output = "\n".join(collected_output)

                yield pb2.ExecutionResponse(
                    result=pb2.ExecutionResult(
                        execution_id=start.execution_id,
                        status=pb2.EXECUTION_SUCCESS if process.returncode == 0 else pb2.EXECUTION_FAILED,
                        exit_code=process.returncode,
                        output=output,
                        error_message="" if process.returncode == 0 else output
                    )
                )

            except subprocess.TimeoutExpired:
                output = "\n".join(collected_output)

                yield pb2.ExecutionResponse(
                    result=pb2.ExecutionResult(
                        execution_id=start.execution_id,
                        status=pb2.EXECUTION_TIMEOUT,
                        exit_code=-1,
                        output=output,
                        error_message="timeout"
                    )
                )

            except Exception as e:
                output = "\n".join(collected_output)

                yield pb2.ExecutionResponse(
                    result=pb2.ExecutionResult(
                        execution_id=start.execution_id,
                        status=pb2.EXECUTION_FAILED,
                        exit_code=-1,
                        output=output,
                        error_message=str(e)
                    )
                )

            finally:
                cleanup_workdir(workdir)


# -------------------------------
# Server bootstrap
# -------------------------------
async def serve():
    server = grpc.aio.server()
    pb2_grpc.add_RuntimeExecutionServiceServicer_to_server(
        RuntimeService(), server
    )

    server.add_insecure_port("[::]:50051")

    print("🚀 Python runtime started on 50051")

    await server.start()
    await server.wait_for_termination()


if __name__ == "__main__":
    asyncio.run(serve())