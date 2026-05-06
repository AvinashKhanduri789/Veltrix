import subprocess
import threading
import time
import os
import signal
import resource


def apply_limits(memory_mb=256, cpu_seconds=2, max_processes=10):
    # Memory limit (address space)
    resource.setrlimit(resource.RLIMIT_AS, (memory_mb * 1024 * 1024, memory_mb * 1024 * 1024))

    # CPU time
    resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))

    # Max processes (fork bomb protection)
    resource.setrlimit(resource.RLIMIT_NPROC, (max_processes, max_processes))


def execute_python(code_bytes, timeout, workdir, stream):
    file_path = os.path.join(workdir, "main.py")

    with open(file_path, "wb") as f:
        f.write(code_bytes)

    process = subprocess.Popen(
        ["python", file_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=workdir,
        bufsize=1,
        preexec_fn=lambda: (os.setsid(), apply_limits())
    )

    def stream_output():
        try:
            for line in process.stdout:
                stream.send_log(line.strip())
        except Exception:
            pass

    t = threading.Thread(target=stream_output, daemon=True)
    t.start()

    try:
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        # Kill entire process group
        try:
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
            time.sleep(1)
            os.killpg(os.getpgid(process.pid), signal.SIGKILL)
        except Exception:
            pass
        return {"error": "timeout"}

    t.join()

    return {
        "exit_code": process.returncode
    }