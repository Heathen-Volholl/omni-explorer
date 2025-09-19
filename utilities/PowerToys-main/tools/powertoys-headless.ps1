<#
.SYNOPSIS
  Headless PowerToys wrapper with JSON output.

.DESCRIPTION
  Provides non-interactive status/start/stop actions for Microsoft PowerToys with timeouts and structured JSON results.
  Useful for automation where you only need to check or toggle the background service.

.EXAMPLES
  pwsh PowerToys-main/tools/powertoys-headless.ps1 -Action status
  pwsh PowerToys-main/tools/powertoys-headless.ps1 -Action start -ToolPath "C:\\Program Files\\PowerToys\\PowerToys.exe"
  pwsh PowerToys-main/tools/powertoys-headless.ps1 -Action stop -Force

.NOTES
  PowerToys has no official CLI for module control. This wrapper limits itself to basic process management.
#>
[CmdletBinding()]
param(
  [ValidateSet('status','start','stop','restart')]
  [string]$Action = 'status',

  [string]$ToolPath,
  [string[]]$Args,
  [switch]$Force,

  [int]$TimeoutSec = 30,
  [string]$LogDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-JsonResult { param([hashtable]$Obj) $Obj | ConvertTo-Json -Compress -Depth 8 }
function New-GuidString { [guid]::NewGuid().ToString('n') }
function Ensure-Directory { param([string]$Path) if ($Path -and -not (Test-Path -LiteralPath $Path)) { [void](New-Item -ItemType Directory -Path $Path -Force) } }
function Quote-Arg { param([string]$s) if ($null -eq $s) { return '""' } if ($s -notmatch '[\s\"]') { return $s } '"' + ($s -replace '"','\"') + '"' }
function Join-Args { param([string[]]$Parts) ($Parts | ForEach-Object { Quote-Arg $_ }) -join ' ' }

function Resolve-PTExe {
  param([string]$Preferred)
  if ($Preferred) { if (Test-Path -LiteralPath $Preferred) { return (Resolve-Path -LiteralPath $Preferred).Path } }
  if ($Env:POWERTOYS_EXE -and (Test-Path -LiteralPath $Env:POWERTOYS_EXE)) { return (Resolve-Path $Env:POWERTOYS_EXE).Path }
  foreach ($name in @('PowerToys','PowerToys.exe')) { $cmd = Get-Command -ErrorAction SilentlyContinue $name; if ($cmd -and $cmd.Source) { return $cmd.Source } }
  # common install paths
  $common = @(
    "$Env:ProgramFiles\PowerToys\PowerToys.exe",
    "$Env:ProgramFiles(x86)\PowerToys\PowerToys.exe"
  )
  foreach ($p in $common) { if ($p -and (Test-Path -LiteralPath $p)) { return $p } }
  return $null
}

function Running-Info {
  $procs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Name -in @('PowerToys','PowerToys.Settings','PowerLauncher') }
  $list = @()
  foreach ($p in $procs) { $list += @{ name=$p.Name; id=$p.Id; started=$p.StartTime.ToString('o') } }
  return $list
}

function Invoke-Start {
  param([string]$Exe,[string[]]$Args,[int]$TimeoutSec,[string]$LogDir)
  Ensure-Directory -Path $LogDir
  $ts = Get-Date
  $guid = New-GuidString
  $outLog = Join-Path $LogDir ("$($ts.ToString('yyyyMMdd_HHmmss'))_powertoys_$guid.out.log")
  $errLog = Join-Path $LogDir ("$($ts.ToString('yyyyMMdd_HHmmss'))_powertoys_$guid.err.log")
  $argLine = if ($Args) { Join-Args -Parts $Args } else { '' }
  $proc = Start-Process -FilePath $Exe -ArgumentList $argLine -PassThru -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog
  $timedOut=$false
  try { if ($TimeoutSec -gt 0) { Start-Sleep -Seconds ([Math]::Min(3,$TimeoutSec)) } } catch {}
  @{ exe=$Exe; args=$Args; outLog=$outLog; errLog=$errLog; timedOut=$timedOut }
}

function Invoke-Stop {
  param([switch]$Force,[int]$TimeoutSec)
  $names = @('PowerToys','PowerToys.Settings','PowerLauncher')
  $stopped = @()
  foreach ($n in $names) {
    $procs = Get-Process -Name $n -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
      try {
        if ($Force) { Stop-Process -Id $p.Id -Force -ErrorAction Stop }
        else { Stop-Process -Id $p.Id -ErrorAction Stop }
        $stopped += @{ name=$p.Name; id=$p.Id }
      } catch {}
    }
  }
  Start-Sleep -Milliseconds 200
  return $stopped
}

if (-not $LogDir) { $LogDir = Join-Path ([System.IO.Path]::GetTempPath()) 'utilities\powertoys' }

$started = Get-Date
try {
  switch ($Action) {
    'status' {
      $exe = Resolve-PTExe -Preferred $ToolPath
      $running = Running-Info
      $ver = $null
      try { if ($exe) { $ver = (Get-Item -LiteralPath $exe).VersionInfo.ProductVersion } } catch {}
      $ended = Get-Date
      $res = @{
        action    = 'status'
        startedAt = $started.ToString('o')
        endedAt   = $ended.ToString('o')
        durationMs= [int]($ended - $started).TotalMilliseconds
        exe       = $exe
        version   = $ver
        running   = $running
        available = [bool]$exe
        success   = $true
      }
      Write-JsonResult -Obj $res
      exit 0
    }
    'start' {
      $exe = Resolve-PTExe -Preferred $ToolPath
      if (-not $exe) { throw 'PowerToys executable not found. Set POWERTOYS_EXE or provide -ToolPath.' }
      $info = Invoke-Start -Exe $exe -Args $Args -TimeoutSec $TimeoutSec -LogDir $LogDir
      $running = Running-Info
      $ended = Get-Date
      $res = @{
        action    = 'start'
        startedAt = $started.ToString('o')
        endedAt   = $ended.ToString('o')
        durationMs= [int]($ended - $started).TotalMilliseconds
        exe       = $info.exe
        args      = $info.args
        outLog    = $info.outLog
        errLog    = $info.errLog
        running   = $running
        success   = ($running.Count -gt 0)
      }
      Write-JsonResult -Obj $res
      exit (if ($res.success) { 0 } else { 1 })
    }
    'stop' {
      $stopped = Invoke-Stop -Force:$Force -TimeoutSec $TimeoutSec
      $running = Running-Info
      $ended = Get-Date
      $res = @{
        action    = 'stop'
        startedAt = $started.ToString('o')
        endedAt   = $ended.ToString('o')
        durationMs= [int]($ended - $started).TotalMilliseconds
        stopped   = $stopped
        running   = $running
        success   = ($running.Count -eq 0)
      }
      Write-JsonResult -Obj $res
      exit (if ($res.success) { 0 } else { 1 })
    }
    'restart' {
      $exe = Resolve-PTExe -Preferred $ToolPath
      if (-not $exe) { throw 'PowerToys executable not found. Set POWERTOYS_EXE or provide -ToolPath.' }
      $null = Invoke-Stop -Force:$Force -TimeoutSec $TimeoutSec
      Start-Sleep -Milliseconds 300
      $info = Invoke-Start -Exe $exe -Args $Args -TimeoutSec $TimeoutSec -LogDir $LogDir
      $running = Running-Info
      $ended = Get-Date
      $res = @{
        action    = 'restart'
        startedAt = $started.ToString('o')
        endedAt   = $ended.ToString('o')
        durationMs= [int]($ended - $started).TotalMilliseconds
        exe       = $info.exe
        args      = $info.args
        outLog    = $info.outLog
        errLog    = $info.errLog
        running   = $running
        success   = ($running.Count -gt 0)
      }
      Write-JsonResult -Obj $res
      exit (if ($res.success) { 0 } else { 1 })
    }
  }
}
catch {
  $err = $_
  $res = @{
    action    = $Action
    startedAt = $started.ToString('o')
    endedAt   = (Get-Date).ToString('o')
    durationMs= [int]((Get-Date) - $started).TotalMilliseconds
    exe       = $null
    args      = $Args
    outLog    = $null
    errLog    = $null
    exitCode  = 2
    timedOut  = $false
    success   = $false
    error     = ($err.Exception.Message ?? $err.ToString())
  }
  Write-JsonResult -Obj $res
  exit 2
}

