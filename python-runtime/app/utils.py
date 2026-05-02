import os
import tempfile
import shutil

def create_workdir():
    return tempfile.mkdtemp(prefix="exec_")

def cleanup_workdir(path):
    shutil.rmtree(path, ignore_errors=True)