<#
.SYNOPSIS
  Headless CrystalDiskInfo-style disk health report with JSON output.

.DESCRIPTION
  Collects per-disk model/serial/size and failure prediction via WMI/CIM, with optional attempt to invoke CrystalDiskInfo if available.
  Always returns a single JSON object describing the run and per-disk results. Suitable for background/AI usage.

.NOTES
  - WMI/CIM classes used: Win32_DiskDrive (root/cimv2), MSStorageDriver_FailurePredictStatus (root/wmi).
  - Temperature/SMART attribute parsing is vendor-specific; this script reports PredictFailure and basic metadata.
  - If a CrystalDiskInfo executable is provided/found, the script attempts a non-interactive run and captures logs only.
#>
[CmdletBinding()]
param(
  [ValidateSet('report','health')]
  [string]$Action = 'report',

  [string]$ToolPath,
  [switch]$TryExe = $true,
  [int]$TimeoutSec = 60,
  [string]$LogDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-JsonResult { param([hashtable]$Obj) $Obj | ConvertTo-Json -Compress -Depth 6 }
function New-GuidString { [guid]::NewGuid().ToString('n') }
function Ensure-Directory { param([string]$Path) if ($Path -and -not (Test-Path -LiteralPath $Path)) { [void](New-Item -ItemType Directory -Path $Path -Force) } }
function Quote-Arg { param([string]$s) if ($null -eq $s) { return '""' } if ($s -notmatch '[\s\"]') { return $s } '"' + ($s -replace '"','\"') + '"' }
function Join-Args { param([string[]]$Parts) ($Parts | ForEach-Object { Quote-Arg $_ }) -join ' ' }

function Resolve-Exe {
  param([string]$Preferred,[string[]]$Names,[string]$EnvVar)
  if ($Preferred) { $cmd = Get-Command -ErrorAction SilentlyContinue --% $Preferred; if ($cmd) { return $cmd.Source } }
  if ($Env:$EnvVar -and (Test-Path -LiteralPath $Env:$EnvVar)) { return (Resolve-Path $Env:$EnvVar).Path }
  foreach ($n in $Names) { $cmd = Get-Command -ErrorAction SilentlyContinue $n; if ($cmd) { return $cmd.Source } }
  return $null
}

function Invoke-Process {
  param([string]$Exe,[string[]]$Args,[int]$TimeoutSec,[string]$LogDir,[string]$Tag)
  Ensure-Directory -Path $LogDir
  $ts = Get-Date
  $guid = New-GuidString
  $outLog = Join-Path $LogDir ("$($ts.ToString('yyyyMMdd_HHmmss'))_${Tag}_$guid.out.log")
  $errLog = Join-Path $LogDir ("$($ts.ToString('yyyyMMdd_HHmmss'))_${Tag}_$guid.err.log")
  $argLine = Join-Args -Parts $Args
  $proc = Start-Process -FilePath $Exe -ArgumentList $argLine -NoNewWindow -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog
  $timedOut = $false
  try {
    if ($TimeoutSec -gt 0) { $proc | Wait-Process -Timeout $TimeoutSec | Out-Null } else { $proc | Wait-Process | Out-Null }
  } catch { $timedOut = $true; try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {} }
  $exitCode = if ($proc.HasExited) { $proc.ExitCode } else { -1 }
  @{ exe=$Exe; args=$Args; outLog=$outLog; errLog=$errLog; exitCode=$exitCode; timedOut=$timedOut }
}

function Get-DiskStatus {
  $disks = @()
  $driveInfo = Get-CimInstance -Namespace root/cimv2 -ClassName Win32_DiskDrive
  $predict = @{}
  try {
    $predRows = Get-WmiObject -Namespace root/wmi -Class MSStorageDriver_FailurePredictStatus -ErrorAction Stop
    foreach ($p in $predRows) { $predict[$p.InstanceName] = $p }
  } catch { }

  $idx = 0
  foreach ($d in $driveInfo) {
    $entry = @{ index=$idx; model=$d.Model; serial=$d.SerialNumber; firmware=$d.FirmwareRevision; sizeBytes=[uint64]$d.Size; interface=$d.InterfaceType; pnp=$d.PNPDeviceID; predictFailure=$null; reason=$null; healthStatus=$null; temperatureC=$null }
    # Try to map predict status by InstanceName heuristic
    foreach ($k in $predict.Keys) {
      if ($d.PNPDeviceID -and $k -like "*$($d.PNPDeviceID.Replace('\\','_').Replace('&','_'))*") {
        $entry.predictFailure = [bool]$predict[$k].PredictFailure
        $entry.reason = $predict[$k].Reason
        break
      }
    }
    # Optional: Get-PhysicalDisk health if available
    try {
      $pd = Get-PhysicalDisk -ErrorAction Stop | Where-Object { $_.FriendlyName -eq $d.Model -or $_.DeviceId -eq $d.Index }
      if ($pd) { $entry.healthStatus = "$($pd.HealthStatus)" }
    } catch { }
    $disks += $entry
    $idx++
  }
  return $disks
}

# Defaults
if (-not $LogDir) { $LogDir = Join-Path ([System.IO.Path]::GetTempPath()) 'utilities\crystaldiskinfo' }

$started = Get-Date
$exeInfo = $null

try {
  $exePath = $null
  if ($TryExe) { $exePath = Resolve-Exe -Preferred $ToolPath -Names @('DiskInfo64','CrystalDiskInfo','CrystalDiskInfo64') -EnvVar 'CRYSTALDISKINFO_EXE' }
  if ($exePath) {
    # Best-effort non-interactive run (CLI switches differ by version; logs captured regardless)
    $exeInfo = Invoke-Process -Exe $exePath -Args @('/CopyExit') -TimeoutSec $TimeoutSec -LogDir $LogDir -Tag 'crystaldiskinfo'
  }

  $disks = Get-DiskStatus
  $ended = Get-Date
  $res = @{
    action    = $Action
    startedAt = $started.ToString('o')
    endedAt   = $ended.ToString('o')
    durationMs= [int]($ended - $started).TotalMilliseconds
    exe       = if ($exeInfo) { $exeInfo.exe } else { $null }
    args      = if ($exeInfo) { $exeInfo.args } else { $null }
    outLog    = if ($exeInfo) { $exeInfo.outLog } else { $null }
    errLog    = if ($exeInfo) { $exeInfo.errLog } else { $null }
    exitCode  = if ($exeInfo) { $exeInfo.exitCode } else { 0 }
    timedOut  = if ($exeInfo) { $exeInfo.timedOut } else { $false }
    success   = if ($exeInfo) { (-not $exeInfo.timedOut) -and ($exeInfo.exitCode -eq 0) } else { $true }
    disks     = $disks
  }

  Write-JsonResult -Obj $res
  exit ($res.exitCode)
}
catch {
  $err = $_
  $res = @{
    action    = $Action
    startedAt = $started.ToString('o')
    endedAt   = (Get-Date).ToString('o')
    durationMs= $null
    exe       = if ($exeInfo) { $exeInfo.exe } else { $null }
    args      = if ($exeInfo) { $exeInfo.args } else { $null }
    outLog    = if ($exeInfo) { $exeInfo.outLog } else { $null }
    errLog    = if ($exeInfo) { $exeInfo.errLog } else { $null }
    exitCode  = 2
    timedOut  = if ($exeInfo) { $exeInfo.timedOut } else { $false }
    success   = $false
    error     = ($err.Exception.Message ?? $err.ToString())
    disks     = @()
  }
  Write-JsonResult -Obj $res
  exit 2
}

