<#
.SYNOPSIS
  Headless ImageMagick (magick) wrapper with JSON output.

.DESCRIPTION
  Runs common ImageMagick tasks non-interactively (identify, convert, thumbnail) with timeouts and structured JSON.
  Captures logs to files; parses minimal metadata for identify when available.

.EXAMPLES
  pwsh ImageMagick-main/tools/imagemagick-headless.ps1 -Action identify -Input C:\images\a.jpg
  pwsh ImageMagick-main/tools/imagemagick-headless.ps1 -Action convert -Input in.jpg -Output out.png -Strip -Quality 90
  pwsh ImageMagick-main/tools/imagemagick-headless.ps1 -Action thumbnail -Input in.jpg -Output thumb.jpg -Width 640 -Height 640

.NOTES
  Uses `magick` CLI (preferred on Windows) via PATH or $Env:MAGICK_EXE.
#>
[CmdletBinding()]
param(
  [ValidateSet('identify','convert','thumbnail')]
  [string]$Action = 'identify',

  [string]$Input,
  [string]$Output,

  [int]$Width,
  [int]$Height,
  [string]$Resize,
  [int]$Quality,
  [switch]$Strip,
  [string[]]$Extra,

  [switch]$NoOverwrite,
  [int]$TimeoutSec = 600,
  [string]$ToolPath,
  [string]$LogDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-JsonResult { param([hashtable]$Obj) $Obj | ConvertTo-Json -Compress -Depth 8 }
function New-GuidString { [guid]::NewGuid().ToString('n') }
function Ensure-Directory { param([string]$Path) if ($Path -and -not (Test-Path -LiteralPath $Path)) { [void](New-Item -ItemType Directory -Path $Path -Force) } }
function Quote-Arg { param([string]$s) if ($null -eq $s) { return '""' } if ($s -notmatch '[\s\"]') { return $s } '"' + ($s -replace '"','\"') + '"' }
function Join-Args { param([string[]]$Parts) ($Parts | ForEach-Object { Quote-Arg $_ }) -join ' ' }

function Resolve-MagickExe {
  param([string]$Preferred)
  if ($Preferred) { $cmd = Get-Command -ErrorAction SilentlyContinue --% $Preferred; if ($cmd) { return $cmd.Source } }
  if ($Env:MAGICK_EXE -and (Test-Path -LiteralPath $Env:MAGICK_EXE)) { return (Resolve-Path $Env:MAGICK_EXE).Path }
  foreach ($name in @('magick','magick.exe')) { $cmd = Get-Command -ErrorAction SilentlyContinue $name; if ($cmd -and $cmd.Source) { return $cmd.Source } }
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
  try { if ($TimeoutSec -gt 0) { $proc | Wait-Process -Timeout $TimeoutSec | Out-Null } else { $proc | Wait-Process | Out-Null } } catch { $timedOut = $true; try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {} }
  $exitCode = if ($proc.HasExited) { $proc.ExitCode } else { -1 }
  @{ exe=$Exe; args=$Args; outLog=$outLog; errLog=$errLog; exitCode=$exitCode; timedOut=$timedOut }
}

function Build-ResizeSpec {
  if ($Resize) { return $Resize }
  if ($Width -gt 0 -or $Height -gt 0) {
    $w = if ($Width -gt 0) { $Width.ToString() } else { '' }
    $h = if ($Height -gt 0) { $Height.ToString() } else { '' }
    return "$w" + 'x' + "$h"
  }
  return $null
}

function Parse-IdentifyFormat {
  param([string]$OutLog)
  if (-not (Test-Path -LiteralPath $OutLog)) { return $null }
  $line = Get-Content -LiteralPath $OutLog -TotalCount 1 -ErrorAction SilentlyContinue
  if (-not $line) { return $null }
  # Expect format: fmt|width|height|depth|size
  $parts = $line.Trim().Split('|')
  if ($parts.Count -lt 5) { return $null }
  return @{ format=$parts[0]; width=[int]$parts[1]; height=[int]$parts[2]; depth=$parts[3]; size=$parts[4] }
}

function Validate-Inputs {
  switch ($Action) {
    'identify' {
      if (-not $Input) { throw 'Input is required for identify.' }
      if (-not (Test-Path -LiteralPath $Input)) { throw "Input not found: $Input" }
    }
    'convert' {
      if (-not $Input) { throw 'Input is required for convert.' }
      if (-not (Test-Path -LiteralPath $Input)) { throw "Input not found: $Input" }
      if (-not $Output) { throw 'Output is required for convert.' }
    }
    'thumbnail' {
      if (-not $Input) { throw 'Input is required for thumbnail.' }
      if (-not (Test-Path -LiteralPath $Input)) { throw "Input not found: $Input" }
      if (-not $Output) { throw 'Output image path is required for thumbnail.' }
      if (-not ($Width -gt 0 -or $Height -gt 0 -or $Resize)) { throw 'Provide -Width/-Height or -Resize for thumbnail.' }
    }
  }
}

if (-not $LogDir) { $LogDir = Join-Path ([System.IO.Path]::GetTempPath()) 'utilities\imagemagick' }

$started = Get-Date
try {
  Validate-Inputs

  $magick = Resolve-MagickExe -Preferred $ToolPath
  if (-not $magick) { throw 'ImageMagick executable (magick) not found. Install ImageMagick or set MAGICK_EXE.' }

  switch ($Action) {
    'identify' {
      # magick identify -ping -format "%m|%w|%h|%z|%b" input
      $args = @('identify','-ping','-format','%m|%w|%h|%z|%b',$Input)
      $info = Invoke-Process -Exe $magick -Args $args -TimeoutSec $TimeoutSec -LogDir $LogDir -Tag 'magick-identify'
      $parsed = $null
      try { $parsed = Parse-IdentifyFormat -OutLog $info.outLog } catch { }
      $ended = Get-Date
      $res = @{
        action    = 'identify'
        input     = $Input
        startedAt = $started.ToString('o')
        endedAt   = $ended.ToString('o')
        durationMs= [int]($ended - $started).TotalMilliseconds
        exe       = $info.exe
        args      = $info.args
        outLog    = $info.outLog
        errLog    = $info.errLog
        exitCode  = $info.exitCode
        timedOut  = $info.timedOut
        success   = (-not $info.timedOut) -and ($info.exitCode -eq 0)
        identify  = $parsed
      }
      Write-JsonResult -Obj $res
      exit ($res.exitCode)
    }
    'convert' {
      if ($NoOverwrite.IsPresent -and (Test-Path -LiteralPath $Output)) { throw "Output already exists and -NoOverwrite is set: $Output" }
      $outDir = Split-Path -LiteralPath $Output -Parent
      if ($outDir) { Ensure-Directory -Path $outDir }
      $resizeSpec = Build-ResizeSpec
      # magick input [ops] output
      $args = New-Object System.Collections.Generic.List[string]
      $args.Add($Input)
      if ($Strip) { $args.Add('-strip') }
      if ($resizeSpec) { $args.Add('-resize'); $args.Add($resizeSpec) }
      if ($Quality -gt 0) { $args.Add('-quality'); $args.Add($Quality.ToString()) }
      if ($Extra) { foreach ($e in $Extra) { $args.Add($e) } }
      $args.Add($Output)
      $info = Invoke-Process -Exe $magick -Args $args.ToArray() -TimeoutSec $TimeoutSec -LogDir $LogDir -Tag 'magick-convert'
      $ended = Get-Date
      $res = @{
        action    = 'convert'
        input     = $Input
        output    = $Output
        width     = $Width
        height    = $Height
        resize    = $resizeSpec
        quality   = $Quality
        strip     = [bool]$Strip
        startedAt = $started.ToString('o')
        endedAt   = $ended.ToString('o')
        durationMs= [int]($ended - $started).TotalMilliseconds
        exe       = $info.exe
        args      = $info.args
        outLog    = $info.outLog
        errLog    = $info.errLog
        exitCode  = $info.exitCode
        timedOut  = $info.timedOut
        success   = (-not $info.timedOut) -and ($info.exitCode -eq 0)
      }
      Write-JsonResult -Obj $res
      exit ($res.exitCode)
    }
    'thumbnail' {
      if ($NoOverwrite.IsPresent -and (Test-Path -LiteralPath $Output)) { throw "Output already exists and -NoOverwrite is set: $Output" }
      $outDir = Split-Path -LiteralPath $Output -Parent
      if ($outDir) { Ensure-Directory -Path $outDir }
      $resizeSpec = Build-ResizeSpec
      # magick input [ops] output
      $args = New-Object System.Collections.Generic.List[string]
      $args.Add($Input)
      if ($Strip) { $args.Add('-strip') }
      if ($resizeSpec) { $args.Add('-thumbnail'); $args.Add($resizeSpec) }
      if ($Quality -gt 0) { $args.Add('-quality'); $args.Add($Quality.ToString()) }
      if ($Extra) { foreach ($e in $Extra) { $args.Add($e) } }
      $args.Add($Output)
      $info = Invoke-Process -Exe $magick -Args $args.ToArray() -TimeoutSec $TimeoutSec -LogDir $LogDir -Tag 'magick-thumb'
      $ended = Get-Date
      $res = @{
        action    = 'thumbnail'
        input     = $Input
        output    = $Output
        width     = $Width
        height    = $Height
        resize    = $resizeSpec
        quality   = $Quality
        strip     = [bool]$Strip
        startedAt = $started.ToString('o')
        endedAt   = $ended.ToString('o')
        durationMs= [int]($ended - $started).TotalMilliseconds
        exe       = $info.exe
        args      = $info.args
        outLog    = $info.outLog
        errLog    = $info.errLog
        exitCode  = $info.exitCode
        timedOut  = $info.timedOut
        success   = (-not $info.timedOut) -and ($info.exitCode -eq 0)
      }
      Write-JsonResult -Obj $res
      exit ($res.exitCode)
    }
  }
}
catch {
  $err = $_
  $res = @{
    action    = $Action
    input     = $Input
    output    = $Output
    startedAt = $started.ToString('o')
    endedAt   = (Get-Date).ToString('o')
    durationMs= [int]((Get-Date) - $started).TotalMilliseconds
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

