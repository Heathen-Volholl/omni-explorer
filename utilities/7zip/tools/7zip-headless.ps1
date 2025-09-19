<#
.SYNOPSIS
  Headless 7-Zip wrapper for AI/automation.

.DESCRIPTION
  Runs 7-Zip non-interactively with timeouts and JSON output.
  Supports actions: compress, extract, list, test.

.EXAMPLES
  pwsh 7zip/tools/7zip-headless.ps1 -Action compress -Archive C:\a.7z -Source C:\data -Format 7z
  pwsh 7zip/tools/7zip-headless.ps1 -Action extract -Archive C:\a.7z -OutDir C:\out

.NOTES
  Looks for 7z/7zz/7za in PATH or uses $Env:SEVENZIP_EXE.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('compress','extract','list','test')]
  [string]$Action,

  [string[]]$Source,
  [string]$Archive,
  [string]$OutDir,
  [ValidateSet('7z','zip','tar','gzip','bzip2','xz','wim','cab','rar','iso','udf','apm','ar','msi','nsis','deb','rpm','cpio','z','dmg','vhd','xar','swm')]
  [string]$Format,
  [string[]]$Include,
  [string[]]$Exclude,
  [string]$Password,
  [int]$TimeoutSec = 600,
  [switch]$NoOverwrite,
  [string]$ToolPath,
  [string]$LogDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-JsonResult {
  param(
    [hashtable]$Obj
  )
  $json = $Obj | ConvertTo-Json -Compress -Depth 6
  Write-Output $json
}

function New-GuidString { [guid]::NewGuid().ToString('n') }

function Ensure-Directory {
  param([string]$Path)
  if (-not $Path) { return }
  if (-not (Test-Path -LiteralPath $Path)) { [void](New-Item -ItemType Directory -Path $Path -Force) }
}

function Resolve-7ZipExe {
  param([string]$Preferred)
  if ($Preferred) {
    $cmd = Get-Command -ErrorAction SilentlyContinue --% $Preferred
    if ($cmd) { return $cmd.Source }
  }
  if ($Env:SEVENZIP_EXE -and (Test-Path -LiteralPath $Env:SEVENZIP_EXE)) { return (Resolve-Path $Env:SEVENZIP_EXE).Path }
  foreach ($name in @('7z','7zz','7za')) {
    $cmd = Get-Command -ErrorAction SilentlyContinue $name
    if ($cmd -and $cmd.Source) { return $cmd.Source }
  }
  throw "7-Zip executable not found. Set SEVENZIP_EXE or install 7-Zip (7z/7zz/7za in PATH)."
}

function Quote-Arg {
  param([string]$s)
  if ($null -eq $s) { return '""' }
  if ($s -notmatch '[\s\"]') { return $s }
  return '"' + ($s -replace '"','\"') + '"'
}

function Join-Args {
  param([string[]]$Parts)
  return ($Parts | ForEach-Object { Quote-Arg $_ }) -join ' '
}

function Validate-Inputs {
  switch ($Action) {
    'compress' {
      if (-not $Archive) { throw 'Archive path is required for compress.' }
      if (-not $Source -or $Source.Count -eq 0) { throw 'At least one Source path is required for compress.' }
      $missing = @()
      foreach ($s in $Source) { if (-not (Test-Path -LiteralPath $s)) { $missing += $s } }
      if ($missing.Count -gt 0) { throw "Source path(s) not found: $($missing -join ', ')" }
    }
    'extract' {
      if (-not $Archive) { throw 'Archive path is required for extract.' }
      if (-not $OutDir) { throw 'OutDir is required for extract.' }
      if (-not (Test-Path -LiteralPath $Archive)) { throw "Archive not found: $Archive" }
    }
    'list' { if (-not $Archive) { throw 'Archive path is required for list.' } if (-not (Test-Path -LiteralPath $Archive)) { throw "Archive not found: $Archive" } }
    'test' { if (-not $Archive) { throw 'Archive path is required for test.' } if (-not (Test-Path -LiteralPath $Archive)) { throw "Archive not found: $Archive" } }
  }
}

function Build-Args {
  $args = New-Object System.Collections.Generic.List[string]
  switch ($Action) {
    'compress' {
      $args.Add('a')
      if ($Format) { $args.Add("-t$Format") }
      if ($NoOverwrite.IsPresent) { $args.Add('-aos') } else { $args.Add('-aoa') }
      $args.Add('-y')
      $args.Add($Archive)
      if ($Password) { $args.Add("-p$Password"); $args.Add('-mhe=on') }
      if ($Include) { foreach ($p in $Include) { $args.Add("-ir!$p") } }
      if ($Exclude) { foreach ($p in $Exclude) { $args.Add("-xr!$p") } }
      foreach ($s in $Source) { $args.Add($s) }
    }
    'extract' {
      $args.Add('x')
      $args.Add('-y')
      if ($NoOverwrite.IsPresent) { $args.Add('-aos') } else { $args.Add('-aoa') }
      if ($OutDir) { $args.Add("-o$OutDir") }
      if ($Password) { $args.Add("-p$Password") }
      $args.Add($Archive)
    }
    'list' {
      $args.Add('l')
      $args.Add($Archive)
    }
    'test' {
      $args.Add('t')
      if ($Password) { $args.Add("-p$Password") }
      $args.Add($Archive)
    }
  }
  return ,$args.ToArray()
}

function Invoke-7Zip {
  param(
    [string]$Exe,
    [string[]]$ArgArray,
    [int]$TimeoutSec,
    [string]$LogDir
  )
  Ensure-Directory -Path $LogDir
  $ts = Get-Date
  $guid = New-GuidString
  $outLog = Join-Path $LogDir ("$($ts.ToString('yyyyMMdd_HHmmss'))_${Action}_$guid.out.log")
  $errLog = Join-Path $LogDir ("$($ts.ToString('yyyyMMdd_HHmmss'))_${Action}_$guid.err.log")

  $argLine = Join-Args -Parts $ArgArray

  $proc = Start-Process -FilePath $Exe -ArgumentList $argLine -NoNewWindow -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog

  $timedOut = $false
  try {
    if ($TimeoutSec -gt 0) {
      $proc | Wait-Process -Timeout $TimeoutSec | Out-Null
    } else {
      $proc | Wait-Process | Out-Null
    }
  } catch {
    $timedOut = $true
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch { }
  }

  $exitCode = if ($proc.HasExited) { $proc.ExitCode } else { -1 }
  $te = Get-Date

  $result = @{ 
    action    = $Action
    archive   = $Archive
    sources   = $Source
    outDir    = $OutDir
    format    = $Format
    startedAt = $ts.ToString('o')
    endedAt   = $te.ToString('o')
    durationMs= [int]($te - $ts).TotalMilliseconds
    exe       = $Exe
    args      = $ArgArray
    outLog    = $outLog
    errLog    = $errLog
    exitCode  = $exitCode
    timedOut  = $timedOut
    success   = (-not $timedOut) -and ($exitCode -eq 0)
  }

  if ($timedOut) { $result.error = "Timed out after $TimeoutSec seconds." }

  return $result
}

# Defaults
if (-not $LogDir) { $LogDir = Join-Path ([System.IO.Path]::GetTempPath()) 'utilities\\7zip' }

try {
  Validate-Inputs

  if ($Action -eq 'extract' -and $OutDir) { Ensure-Directory -Path $OutDir }
  if ($Action -eq 'compress' -and $Archive) {
    $parent = Split-Path -LiteralPath $Archive -Parent
    if ($parent) { Ensure-Directory -Path $parent }
  }

  $exe = Resolve-7ZipExe -Preferred $ToolPath
  $argArray = Build-Args

  $res = Invoke-7Zip -Exe $exe -ArgArray $argArray -TimeoutSec $TimeoutSec -LogDir $LogDir
  Write-JsonResult -Obj $res
  exit ($res.exitCode)
}
catch {
  $err = $_
  $res = @{
    action    = $Action
    archive   = $Archive
    sources   = $Source
    outDir    = $OutDir
    format    = $Format
    startedAt = (Get-Date).ToString('o')
    exe       = $null
    args      = $null
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
