Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ProtoDir = Join-Path $RootDir "proto"
$GoOutDir = Join-Path $RootDir "proto_gen/go"
$NodeOutDir = Join-Path $RootDir "proto_gen/node"

$SchedulerProto = Join-Path $ProtoDir "scheduler.proto"
$LogsProto = Join-Path $ProtoDir "logs.proto"
$EventProtos = @(
  (Join-Path $ProtoDir "events/execution_job.proto"),
  (Join-Path $ProtoDir "events/execution_event.proto"),
  (Join-Path $ProtoDir "events/execution_log.proto")
)

function Require-Command {
  param([Parameter(Mandatory = $true)][string]$Name)

  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $cmd) {
    throw "Missing required command: $Name"
  }
}

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed ($LASTEXITCODE): $Command $($Arguments -join ' ')"
  }
}

Write-Host "[protos] checking required tools..."
Require-Command -Name "protoc"
Require-Command -Name "protoc-gen-go"
Require-Command -Name "protoc-gen-go-grpc"

Write-Host "[protos] cleaning output folders..."
if (Test-Path $GoOutDir) {
  Remove-Item -Recurse -Force $GoOutDir
}
if (Test-Path $NodeOutDir) {
  Remove-Item -Recurse -Force $NodeOutDir
}

New-Item -ItemType Directory -Force -Path $GoOutDir | Out-Null

Write-Host "[protos] generating Go protobufs..."
$goServiceArgs = @(
  "-I", $ProtoDir,
  "--go_out=$GoOutDir",
  "--go_opt=paths=import,module=veltrix/proto",
  "--go-grpc_out=$GoOutDir",
  "--go-grpc_opt=paths=import,module=veltrix/proto",
  $SchedulerProto,
  $LogsProto
)
Invoke-CheckedCommand -Command "protoc" -Arguments $goServiceArgs

$goEventArgs = @(
  "-I", $ProtoDir,
  "--go_out=$GoOutDir",
  "--go_opt=paths=import,module=veltrix/proto"
) + $EventProtos
Invoke-CheckedCommand -Command "protoc" -Arguments $goEventArgs

@"
module veltrix/proto

go 1.24.0
"@ | Set-Content -Path (Join-Path $GoOutDir "go.mod") -Encoding ascii

Write-Host "[protos] generated files:"
Write-Host "  - $GoOutDir"
Write-Host "[protos] done."
