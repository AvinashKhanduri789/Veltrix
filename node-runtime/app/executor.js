const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function executeNode(codeBuffer, timeoutSeconds, workdir, stream) {
  const filePath = path.join(workdir, "main.js");
  fs.writeFileSync(filePath, codeBuffer);

  const child = spawn("node", ["--max-old-space-size=256", filePath], {
    cwd: workdir,
    detached: true
  });

  // STREAM STDOUT
  child.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    lines.forEach(line => {
      if (line.trim()) stream.sendLog(line.trim());
    });
  });

  child.stderr.on("data", (data) => {
    const lines = data.toString().split("\n");
    lines.forEach(line => {
      if (line.trim()) stream.sendLog(line.trim());
    });
  });

  // TIMEOUT
  const timeout = setTimeout(() => {
    try {
      process.kill(-child.pid, "SIGTERM");
      setTimeout(() => process.kill(-child.pid, "SIGKILL"), 1000);
    } catch (e) {}
  }, timeoutSeconds * 1000);

  return new Promise((resolve) => {
    child.on("exit", (code) => {
      clearTimeout(timeout);

      if (code === null) {
        return resolve({ error: "timeout" });
      }

      resolve({ exitCode: code });
    });
  });
}

module.exports = { executeNode };