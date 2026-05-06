import os
import tempfile
import shutil

def create_workdir():
    path = tempfile.mkdtemp(prefix="exec_")
    os.chmod(path, 0o700)
    return path

def cleanup_workdir(path):
    shutil.rmtree(path, ignore_errors=True)