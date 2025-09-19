<#
.SYNOPSIS
  Headless SQLite (sqlite3) wrapper with JSON output.

.DESCRIPTION
  Runs sqlite3 non-interactively to query, execute SQL, import CSV, and export results with timeouts and structured JSON.
  Captures stdout/stderr to logs; for JSON queries, attempts to parse stdout as JSON.

.EXAMPLES
  pwsh sqlite-master/tools/sqlite-headless.ps1 -Action version
  pwsh sqlite-master/tools/sqlite-headless.ps1 -Action query -Db .\app.db -Sql "select count(*) as n from users" -Format json
  pwsh sqlite-master/tools/sqlite-headless.ps1 -Action exec -Db .\app.db -Sql "create table if not exists t(id integer);"
  pwsh sqlite-master/tools/sqlite-headless.ps1 -Action import -Db .\app.db -Csv data.csv -Table t -SkipHeader
  pwsh sqlite-master/tools/sqlite-headless.ps1 -Action export -Db .\app.db -Sql "select * from t" -Format csv -Output out.csv

.NOTES
  Requires `sqlite3` in PATH or set $Env:SQLITE_EXE.
#>
[CmdletBinding()]
param(
  [ValidateSet('version','query','exec','import','export')]
  [string]$Action = 'query',

  [string]$Db,
  [string]$Sql,
  [string]$SqlFile,

  # Import
  [string]$Csv,
  [string]$Table,
  [switch]$SkipHeader,

  # Export/Query
  [ValidateSet('json','csv')]
  [string]$Format = 'json',
  [string]$Output,

  [int]$TimeoutSec = 60,
  [string]$ToolPath,
  [string]$LogDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-JsonResult { param([hashtable]$Obj) $Obj | ConvertTo-Json -Compress -Depth 10 }
function New-GuidString { [guid]::NewGuid().ToString('n') }
function Ensure-Directory { param([string]$Path) if ($Path -and -not (Test-Path -LiteralPath $Path)) { [void](New-Item -ItemType Directory -Path $Path -Force) } }
function Quote-Arg { param([string]$s) if ($null -eq $s) { return '""' } if ($s -notmatch '[\s\"]') { return $s } '"' + ($s -replace '"','\"') + '"' }
function Join-Args { param([string[]]$Parts) ($Parts | ForEach-Object { Quote-Arg $_ }) -join ' ' }

function Resolve-SqliteExe {
  param([string]$Preferred)
  if ($Preferred) { $cmd = Get-Command -ErrorAction SilentlyContinue --% $Preferred; if ($cmd) { return $cmd.Source } }
  if ($Env:SQLITE_EXE -and (Test-Path -LiteralPath $Env:SQLITE_EXE)) { return (Resolve-Path $Env:SQLITE_EXE).Path }
  foreach ($name in @('sqlite3','sqlite3.exe')) { $cmd = Get-Command -ErrorAction SilentlyContinue $name; if ($cmd -and $cmd.Source) { return $cmd.Source } }
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
    'version' { }
    'query' {
      if (-not $Db) { throw 'Db path is required for query.' }
      if (-not (Test-Path -LiteralPath $Db)) { throw "Db not found: $Db" }
      if (-not $Sql -and -not $SqlFile) { throw 'Provide -Sql or -SqlFile for query.' }
    }
    'exec' {
      if (-not $Db) { throw 'Db path is required for exec.' }
      if (-not $Sql -and -not $SqlFile) { throw 'Provide -Sql or -SqlFile for exec.' }
    }
    'import' {
      if (-not $Db) { throw 'Db path is required for import.' }
      if (-not $Csv) { throw 'Csv path is required for import.' }
      if (-not (Test-Path -LiteralPath $Csv)) { throw "Csv not found: $Csv" }
      if (-not $Table) { throw 'Table name is required for import.' }
    }
    'export' {
      if (-not $Db) { throw 'Db path is required for export.' }
      if (-not $Sql) { throw 'Sql is required for export.' }
      if (-not $Output) { throw 'Output path is required for export.' }
    }
  }
}

if (-not $LogDir) { $LogDir = Join-Path ([System.IO.Path]::GetTempPath()) 'utilities\sqlite' }

$started = Get-Date
$tempSql = $null
try {
  Validate-Inputs

  $sqlite = Resolve-SqliteExe -Preferred $ToolPath
  if (-not $sqlite -and $Action -ne 'version') { throw 'sqlite3 executable not found. Install SQLite or set SQLITE_EXE.' }

  if ($SqlFile -and -not $Sql) { if (-not (Test-Path -LiteralPath $SqlFile)) { throw "SqlFile not found: $SqlFile" } $Sql = Get-Content -LiteralPath $SqlFile -Raw -ErrorAction Stop }

  switch ($Action) {
    'version' {
      $exe = ($sqlite) ? $sqlite : (Resolve-SqliteExe -Preferred $ToolPath)
      if (-not $exe) { throw 'sqlite3 executable not found. Install SQLite or set SQLITE_EXE.' }
      $info = Invoke-Process -Exe $exe -Args @('-version') -TimeoutSec $TimeoutSec -LogDir $LogDir -Tag 'sqlite-version'
      $version = $null
      try { if (Test-Path -LiteralPath $info.outLog) { $version = (Get-Content -LiteralPath $info.outLog -TotalCount 1 -ErrorAction SilentlyContinue).Trim() } } catch {}
      $ended = Get-Date
      $res = @{
        action    = 'version'
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
        version   = $version
      }
      Write-JsonResult -Obj $res; exit ($res.exitCode)
    }
    'query' {
      $args = New-Object System.Collections.Generic.List[string]
      $args.Add($Db)
      if ($Format -eq 'json') { $args.Add('-cmd'); $args.Add('.mode json'); $args.Add('-cmd'); $args.Add('.headers on') }
      elseif ($Format -eq 'csv') { $args.Add('-cmd'); $args.Add('.mode csv'); $args.Add('-cmd'); $args.Add('.headers on') }
      $args.Add($Sql)
      $info = Invoke-Process -Exe $sqlite -Args $args.ToArray() -TimeoutSec $TimeoutSec -LogDir $LogDir -Tag 'sqlite-query'

      if ($Output -and (Test-Path -LiteralPath $info.outLog)) {
        Ensure-Directory -Path (Split-Path -LiteralPath $Output -Parent)
        Copy-Item -LiteralPath $info.outLog -Destination $Output -Force
      }

      $resultText = $null; $resultJson = $null
      try {
        if ($Format -eq 'json' -and (Test-Path -LiteralPath $info.outLog)) {
          $txt = Get-Content -LiteralPath $info.outLog -Raw -ErrorAction Stop
          $trim = $txt.Trim()
          if ($trim.StartsWith('[') -or $trim.StartsWith('{')) { try { $resultJson = $trim | ConvertFrom-Json -ErrorAction Stop } catch {} }
          $resultText = $txt
        }
      } catch {}

      $ended = Get-Date
      $res = @{
        action    = 'query'
        db        = $Db
        format    = $Format
        sql       = $Sql
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
        resultText= $resultText
        resultJson= $resultJson
      }
      Write-JsonResult -Obj $res; exit ($res.exitCode)
    }
    'exec' {
      $args = New-Object System.Collections.Generic.List[string]
      $args.Add($Db)
      $args.Add($Sql)
      $info = Invoke-Process -Exe $sqlite -Args $args.ToArray() -TimeoutSec $TimeoutSec -LogDir $LogDir -Tag 'sqlite-exec'
      $ended = Get-Date
      $res = @{
        action    = 'exec'
        db        = $Db
        sql       = $Sql
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
      Write-JsonResult -Obj $res; exit ($res.exitCode)
    }
    'import' {
      $args = New-Object System.Collections.Generic.List[string]
      $args.Add($Db)
      $args.Add('-cmd'); $args.Add('.mode csv')
      if ($SkipHeader.IsPresent) { $args.Add('-cmd'); $args.Add('.import --skip 1 ' + $Csv + ' ' + $Table) }
      else { $args.Add('-cmd'); $args.Add('.import ' + $Csv + ' ' + $Table) }
      $args.Add('.quit')
      $info = Invoke-Process -Exe $sqlite -Args $args.ToArray() -TimeoutSec $TimeoutSec -LogDir $LogDir -Tag 'sqlite-import'
      $ended = Get-Date
      $res = @{
        action    = 'import'
        db        = $Db
        csv       = $Csv
        table     = $Table
        skipHeader= [bool]$SkipHeader
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
      Write-JsonResult -Obj $res; exit ($res.exitCode)
    }
    'export' {
      Ensure-Directory -Path (Split-Path -LiteralPath $Output -Parent)
      $args = New-Object System.Collections.Generic.List[string]
      $args.Add($Db)
      if ($Format -eq 'csv') { $args.Add('-cmd'); $args.Add('.mode csv'); $args.Add('-cmd'); $args.Add('.headers on') }
      elseif ($Format -eq 'json') { $args.Add('-cmd'); $args.Add('.mode json'); $args.Add('-cmd'); $args.Add('.headers on') }
      $args.Add($Sql)
      $info = Invoke-Process -Exe $sqlite -Args $args.ToArray() -TimeoutSec $TimeoutSec -LogDir $LogDir -Tag 'sqlite-export'
      if (Test-Path -LiteralPath $info.outLog) { Copy-Item -LiteralPath $info.outLog -Destination $Output -Force }
      $ended = Get-Date
      $res = @{
        action    = 'export'
        db        = $Db
        format    = $Format
        sql       = $Sql
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
        success   = (-not $info.timedOut) -and ($info.exitCode -eq 0) -and (Test-Path -LiteralPath $Output)
      }
      Write-JsonResult -Obj $res; exit ($res.exitCode)
    }
  }
}
catch {
  $err = $_
  $res = @{
    action    = $Action
    db        = $Db
    sql       = $Sql
    format    = $Format
    output    = $Output
    csv       = $Csv
    table     = $Table
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

