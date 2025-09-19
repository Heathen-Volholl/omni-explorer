<#
.SYNOPSIS
  Headless FFmpeg/FFprobe wrapper with JSON output.

.DESCRIPTION
  Runs common FFmpeg tasks non-interactively (probe, transcode, thumbnail) with timeouts and structured JSON results.
  Captures logs to files and optionally parses ffprobe JSON output.

.EXAMPLES
  pwsh FFmpeg-master/tools/ffmpeg-headless.ps1 -Action probe -Input C:\vids\a.mp4
  pwsh FFmpeg-master/tools/ffmpeg-headless.ps1 -Action transcode -Input in.mp4 -Output out.mp4 -VideoCodec libx264 -Crf 23 -Preset veryfast -NoOverwrite:$false
  pwsh FFmpeg-master/tools/ffmpeg-headless.ps1 -Action thumbnail -Input in.mp4 -Ss 00:00:03.500 -Vf "scale=640:-2" -Output thumb.jpg

.NOTES
  Requires `ffmpeg`/`ffprobe` in PATH or set $Env:FFMPEG_EXE and $Env:FFPROBE_EXE.
#>
[CmdletBinding()]
param(
  [ValidateSet('probe','transcode','thumbnail')]
  [string]$Action = 'probe',

  [string]$Input,
  [string]$Output,

  [string]$VideoCodec,
  [string]$AudioCodec,
  [int]$Crf,
  [string]$Preset,
  [string]$VideoBitrate,
  [string]$AudioBitrate,
  [string]$Vf,
  [string]$Af,
  [string]$Ss,
  [string]$T,
  [string[]]$Extra,

  [switch]$NoOverwrite,
  [int]$TimeoutSec = 900,
  [string]$FfmpegPath,
  [string]$FfprobePath,
  [string]$LogDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-JsonResult { param([hashtable]$Obj) $Obj | ConvertTo-Json -Compress -Depth 8 }
function New-GuidString { [guid]::NewGuid().ToString('n') }
function Ensure-Directory { param([string]$Path) if ($Path -and -not (Test-Path -LiteralPath $Path)) { [void](New-Item -ItemType Directory -Path $Path -Force) } }
function Quote-Arg { param([string]$s) if ($null -eq $s) { return '""' } if ($s -notmatch '[\s\"]') { return $s } '"' + ($s -replace '"','\"') + '"' }
function Join-Args { param([string[]]$Parts) ($Parts | ForEach-Object { Quote-Arg $_ }) -join ' ' }

function Resolve-Exe {
  param([string]$Preferred,[string]$EnvVar,[string[]]$Names)
  if ($Preferred) { $cmd = Get-Command -ErrorAction SilentlyContinue --% $Preferred; if ($cmd) { return $cmd.Source } }
  if ($Env:$EnvVar -and (Test-Path -LiteralPath $Env:$EnvVar)) { return (Resolve-Path $Env:$EnvVar).Path }
  foreach ($n in $Names) { $cmd = Get-Command -ErrorAction SilentlyContinue $n; if ($cmd -and $cmd.Source) { return $cmd.Source } }
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

function Validate-Inputs {
  switch ($Action) {
    'probe' {
      if (-not $Input) { throw 'Input is required for probe.' }
      if (-not (Test-Path -LiteralPath $Input)) { throw "Input not found: $Input" }
    }
    'transcode' {
      if (-not $Input) { throw 'Input is required for transcode.' }
      if (-not (Test-Path -LiteralPath $Input)) { throw "Input not found: $Input" }
      if (-not $Output) { throw 'Output is required for transcode.' }
    }
    'thumbnail' {
      if (-not $Input) { throw 'Input is required for thumbnail.' }
      if (-not (Test-Path -LiteralPath $Input)) { throw "Input not found: $Input" }
      if (-not $Output) { throw 'Output image path is required for thumbnail.' }
    }
  }
}

if (-not $LogDir) { $LogDir = Join-Path ([System.IO.Path]::GetTempPath()) 'utilities\ffmpeg' }

$started = Get-Date
try {
  Validate-Inputs

  $ffmpeg = Resolve-Exe -Preferred $FfmpegPath -EnvVar 'FFMPEG_EXE' -Names @('ffmpeg','ffmpeg.exe')
  $ffprobe = Resolve-Exe -Preferred $FfprobePath -EnvVar 'FFPROBE_EXE' -Names @('ffprobe','ffprobe.exe')

  switch ($Action) {
    'probe' {
      if (-not $ffprobe) { throw 'ffprobe not found. Install FFmpeg or set FFPROBE_EXE.' }
      $args = @('-v','error','-hide_banner','-print_format','json','-show_format','-show_streams','-i',$Input)
      $info = Invoke-Process -Exe $ffprobe -Args $args -TimeoutSec $TimeoutSec -LogDir $LogDir -Tag 'ffprobe'
      $parsed = $null
      try { if (Test-Path -LiteralPath $info.outLog) { $txt = Get-Content -LiteralPath $info.outLog -Raw -ErrorAction Stop; if ($txt.Trim().StartsWith('{')) { $parsed = $txt | ConvertFrom-Json -ErrorAction Stop } } } catch { }
      $ended = Get-Date
      $res = @{
        action    = 'probe'
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
        ffprobe   = $parsed
      }
      Write-JsonResult -Obj $res
      exit ($res.exitCode)
    }
    'transcode' {
      if (-not $ffmpeg) { throw 'ffmpeg not found. Install FFmpeg or set FFMPEG_EXE.' }
      $outDir = Split-Path -LiteralPath $Output -Parent
      if ($outDir) { Ensure-Directory -Path $outDir }
      $args = New-Object System.Collections.Generic.List[string]
      $args.Add('-hide_banner'); $args.Add('-nostdin')
      if ($Ss) { $args.Add('-ss'); $args.Add($Ss) }
      $args.Add('-i'); $args.Add($Input)
      if ($T) { $args.Add('-t'); $args.Add($T) }
      if ($VideoCodec) { $args.Add('-c:v'); $args.Add($VideoCodec) }
      if ($AudioCodec) { $args.Add('-c:a'); $args.Add($AudioCodec) }
      if ($Crf) { $args.Add('-crf'); $args.Add($Crf.ToString()) }
      if ($Preset) { $args.Add('-preset'); $args.Add($Preset) }
      if ($VideoBitrate) { $args.Add('-b:v'); $args.Add($VideoBitrate) }
      if ($AudioBitrate) { $args.Add('-b:a'); $args.Add($AudioBitrate) }
      if ($Vf) { $args.Add('-vf'); $args.Add($Vf) }
      if ($Af) { $args.Add('-af'); $args.Add($Af) }
      if ($Extra) { foreach ($e in $Extra) { $args.Add($e) } }
      if ($NoOverwrite.IsPresent) { $args.Add('-n') } else { $args.Add('-y') }
      $args.Add($Output)

      $info = Invoke-Process -Exe $ffmpeg -Args $args.ToArray() -TimeoutSec $TimeoutSec -LogDir $LogDir -Tag 'ffmpeg'
      $ended = Get-Date
      $res = @{
        action    = 'transcode'
        input     = $Input
        output    = $Output
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
      if (-not $ffmpeg) { throw 'ffmpeg not found. Install FFmpeg or set FFMPEG_EXE.' }
      $outDir = Split-Path -LiteralPath $Output -Parent
      if ($outDir) { Ensure-Directory -Path $outDir }
      $args = New-Object System.Collections.Generic.List[string]
      $args.Add('-hide_banner'); $args.Add('-nostdin')
      if ($Ss) { $args.Add('-ss'); $args.Add($Ss) }
      $args.Add('-i'); $args.Add($Input)
      if ($Vf) { $args.Add('-vf'); $args.Add($Vf) }
      $args.Add('-frames:v'); $args.Add('1')
      $args.Add('-q:v'); $args.Add('2')
      if ($NoOverwrite.IsPresent) { $args.Add('-n') } else { $args.Add('-y') }
      $args.Add($Output)

      $info = Invoke-Process -Exe $ffmpeg -Args $args.ToArray() -TimeoutSec $TimeoutSec -LogDir $LogDir -Tag 'ffmpeg'
      $ended = Get-Date
      $res = @{
        action    = 'thumbnail'
        input     = $Input
        output    = $Output
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

