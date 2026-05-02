import subprocess
import threading
import time
import os

def execute_python(code_bytes, timeout, workdir, stream):

    file_path = os.path.join(workdir, "main.py")

    with open(file_path, "wb") as f:
        f.write(code_bytes)

    process = subprocess.Popen(
        ["python", file_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=workdir
    )

    def stream_output():
        for line in process.stdout:
            stream.send_log(line.strip())

    t = threading.Thread(target=stream_output)
    t.start()

    try:
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        process.kill()
        return {"error": "timeout"}

    t.join()

    return {
        "exit_code": process.returncode
    }