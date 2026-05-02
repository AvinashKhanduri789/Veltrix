import grpc
import asyncio
import os
import subprocess
import tempfile
import shutil
import time

import runtime_execution_pb2 as pb2
import runtime_execution_pb2_grpc as pb2_grpc


def create_workdir():
    return tempfile.mkdtemp(prefix="exec_")


def cleanup_workdir(path):
    shutil.rmtree(path, ignore_errors=True)


class RuntimeService(pb2_grpc.RuntimeExecutionServiceServicer):

    async def ExecuteExecution(self, request_iterator, context):

        async for req in request_iterator:

            if not req.HasField("start"):
                continue

            start = req.start

            workdir = create_workdir()
            file_path = os.path.join(workdir, "main.py")

            collected_output = []

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
                )

                start_time = time.time()

                # Stream logs line-by-line
                while True:
                    if process.stdout is None:
                        break

                    line = process.stdout.readline()

                    if line == "" and process.poll() is not None:
                        break

                    if line:
                        line = line.rstrip()
                        collected_output.append(line)

                        yield pb2.ExecutionResponse(
                            log=pb2.ExecutionLog(
                                execution_id=start.execution_id,
                                message=line,
                                type=pb2.STDOUT,
                                timestamp=str(time.time())
                            )
                        )

                    # Timeout check (manual safeguard)
                    if time.time() - start_time > start.timeout_seconds:
                        process.kill()
                        raise subprocess.TimeoutExpired(cmd="python", timeout=start.timeout_seconds)

                process.wait()

                output = "\n".join(collected_output)

                # Final result
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
