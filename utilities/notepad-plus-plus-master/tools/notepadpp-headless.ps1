<#
.SYNOPSIS
  Headless text ops (Notepad++-style) with JSON output.

.DESCRIPTION
  Provides fast, non-interactive find/replace and newline/encoding conversions across files or folders.
  Emits a single JSON summary per run, suitable for background/AI use. No GUI is launched.

.EXAMPLES
  # Find occurrences (regex)
  pwsh notepad-plus-plus-master/tools/notepadpp-headless.ps1 -Action find -Root C:\proj -Include "*.txt","*.md" -Pattern "TODO:(.+)" -Regex -MaxResults 100

  # In-place replace (literal), create .bak backups
  pwsh notepad-plus-plus-master/tools/notepadpp-headless.ps1 -Action replace -Root C:\proj -Include "*.js" -Pattern "var " -Replacement "let " -Backup

  # Convert newlines to LF
  pwsh notepad-plus-plus-master/tools/notepadpp-headless.ps1 -Action newline -Paths C:\proj\README.md -NewLine LF

  # Convert encoding to UTF-8 (no BOM)
  pwsh notepad-plus-plus-master/tools/notepadpp-headless.ps1 -Action encoding -Paths C:\proj\notes.txt -ToEncoding utf8

.NOTES
  This is a utility wrapper inspired by Notepad++ features, implemented purely in PowerShell/.NET for headless use.
#>
[CmdletBinding()]
param(
  [ValidateSet('find','replace','newline','encoding')]
  [string]$Action = 'find',

  # Target selection
  [string[]]$Paths,
  [string]$Root,
  [string[]]$Include,
  [string[]]$Exclude,

  # Find/Replace
  [string]$Pattern,
  [string]$Replacement,
  [switch]$Regex,
  [switch]$CaseSensitive,
  [switch]$Multiline,
  [switch]$Singleline,
  [int]$MaxResults = 1000,
  [switch]$DryRun,
  [switch]$Backup,

  # Newlines/Encoding
  [ValidateSet('LF','CRLF')]
  [string]$NewLine,
  [ValidateSet('utf8','utf8bom','utf16le','utf16be','ascii')]
  [string]$ToEncoding,

  # Execution
  [int]$TimeoutSec = 120,
  [string]$LogDir
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-JsonResult { param([hashtable]$Obj) $Obj | ConvertTo-Json -Compress -Depth 8 }
function New-GuidString { [guid]::NewGuid().ToString('n') }
function Ensure-Directory { param([string]$Path) if ($Path -and -not (Test-Path -LiteralPath $Path)) { [void](New-Item -ItemType Directory -Path $Path -Force) } }

function Get-Targets {
  $targets = New-Object System.Collections.Generic.List[string]
  if ($Paths) {
    foreach ($p in $Paths) {
      if (Test-Path -LiteralPath $p -PathType Leaf) { $targets.Add((Resolve-Path -LiteralPath $p).Path) }
      elseif (Test-Path -LiteralPath $p -PathType Container) {
        $files = Get-ChildItem -LiteralPath $p -Recurse -File -ErrorAction SilentlyContinue
        foreach ($f in $files) { $targets.Add($f.FullName) }
      }
    }
  }
  if ($Root) {
    $rootPath = (Resolve-Path -LiteralPath $Root).Path
    $files = Get-ChildItem -LiteralPath $rootPath -Recurse -File -ErrorAction SilentlyContinue
    foreach ($f in $files) { $targets.Add($f.FullName) }
  }
  # Include filter
  if ($Include -and $Include.Count -gt 0) {
    $inc = $Include
    $targets = [System.Collections.Generic.List[string]](@($targets | Where-Object { $fp = $_; foreach ($pat in $inc) { if ([System.Management.Automation.WildcardPattern]::new($pat).IsMatch([System.IO.Path]::GetFileName($fp))) { return $true } }; return $false }))
  }
  # Exclude filter
  if ($Exclude -and $Exclude.Count -gt 0) {
    $ex = $Exclude
    $targets = [System.Collections.Generic.List[string]](@($targets | Where-Object { $fp = $_; foreach ($pat in $ex) { if ([System.Management.Automation.WildcardPattern]::new($pat).IsMatch([System.IO.Path]::GetFileName($fp))) { return $false } }; return $true }))
  }
  return ,(@($targets | Select-Object -Unique))
}

function Read-AllTextAuto {
  param([string]$Path)
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  # Detect BOM
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    return [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length-3)
  } elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
    return [System.Text.Encoding]::Unicode.GetString($bytes, 2, $bytes.Length-2) # UTF-16 LE
  } elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
    return [System.Text.Encoding]::BigEndianUnicode.GetString($bytes, 2, $bytes.Length-2) # UTF-16 BE
  } else {
    # Fallback UTF8 (no BOM)
    return [System.Text.Encoding]::UTF8.GetString($bytes)
  }
}

function Write-TextWithEncoding {
  param([string]$Path,[string]$Text,[string]$Encoding)
  switch ($Encoding) {
    'utf8'    { [System.IO.File]::WriteAllText($Path, $Text, New-Object System.Text.UTF8Encoding($false)) }
    'utf8bom' { [System.IO.File]::WriteAllText($Path, $Text, New-Object System.Text.UTF8Encoding($true)) }
    'utf16le' { [System.IO.File]::WriteAllText($Path, $Text, [System.Text.Encoding]::Unicode) }
    'utf16be' { [System.IO.File]::WriteAllText($Path, $Text, [System.Text.Encoding]::BigEndianUnicode) }
    'ascii'   { [System.IO.File]::WriteAllText($Path, $Text, [System.Text.Encoding]::ASCII) }
    default   { [System.IO.File]::WriteAllText($Path, $Text, New-Object System.Text.UTF8Encoding($false)) }
  }
}

function Apply-NewLine {
  param([string]$Text,[string]$NewLine)
  $norm = $Text -replace "\r\n","\n" -replace "\r","\n"
  if ($NewLine -eq 'CRLF') { return ($norm -replace "\n","`r`n") }
  else { return $norm }
}

if (-not $LogDir) { $LogDir = Join-Path ([System.IO.Path]::GetTempPath()) 'utilities\notepadpp' }
Ensure-Directory -Path $LogDir
$ts = Get-Date
$guid = New-GuidString
$outLog = Join-Path $LogDir ("$($ts.ToString('yyyyMMdd_HHmmss'))_npp_$guid.out.log")

function Log { param([string]$Line) Add-Content -LiteralPath $outLog -Value $Line }

$started = Get-Date
$files = @()
$changedFiles = @()
$matches = @()
$totalReplacements = 0

try {
  $targets = Get-Targets
  if (-not $targets -or $targets.Count -eq 0) { throw 'No files matched. Provide -Paths and/or -Root with -Include filters.' }

  $deadline = if ($TimeoutSec -gt 0) { $started.AddSeconds($TimeoutSec) } else { [datetime]::MaxValue }
  $countResults = 0

  switch ($Action) {
    'find' {
      if (-not $Pattern) { throw 'Pattern is required for find.' }
      $options = [System.Text.RegularExpressions.RegexOptions]::None
      if (-not $CaseSensitive) { $options = $options -bor [System.Text.RegularExpressions.RegexOptions]::IgnoreCase }
      if ($Multiline) { $options = $options -bor [System.Text.RegularExpressions.RegexOptions]::Multiline }
      if ($Singleline) { $options = $options -bor [System.Text.RegularExpressions.RegexOptions]::Singleline }
      $rx = $null
      if ($Regex) { $rx = [System.Text.RegularExpressions.Regex]::new($Pattern, $options) }
      foreach ($f in $targets) {
        if (Get-Date -gt $deadline) { throw "Timed out after $TimeoutSec seconds." }
        $files += $f
        try { $text = Read-AllTextAuto -Path $f } catch { continue }
        if ($Regex) {
          foreach ($m in $rx.Matches($text)) {
            $lineNum = ($text.Substring(0, $m.Index) -split "\n").Count
            $lineStart = $text.LastIndexOf("`n", $m.Index)
            if ($lineStart -lt 0) { $lineStart = -1 }
            $lineEnd = $text.IndexOf("`n", $m.Index)
            if ($lineEnd -lt 0) { $lineEnd = $text.Length }
            $lineText = $text.Substring($lineStart+1, $lineEnd-($lineStart+1)).TrimEnd("`r")
            $matches += @{ file=$f; line=$lineNum; column=($m.Index-($lineStart+1)+1); value=$m.Value; pattern=$Pattern; regex=$true; lineText=$lineText }
            $countResults++
            if ($countResults -ge $MaxResults) { break }
          }
        } else {
          $comparison = if ($CaseSensitive) { 'Ordinal' } else { 'OrdinalIgnoreCase' }
          $ln = 0
          foreach ($line in ($text -split "\n")) {
            $ln++
            $lineClean = $line.TrimEnd("`r")
            $idx = [CultureInfo]::InvariantCulture.CompareInfo.IndexOf($lineClean, $Pattern, [System.Globalization.CompareOptions]::IgnoreCase)
            if ($CaseSensitive) { $idx = $lineClean.IndexOf($Pattern) }
            if ($idx -ge 0) {
              $matches += @{ file=$f; line=$ln; column=($idx+1); value=$Pattern; pattern=$Pattern; regex=$false; lineText=$lineClean }
              $countResults++
              if ($countResults -ge $MaxResults) { break }
            }
          }
        }
        if ($countResults -ge $MaxResults) { break }
      }
      $success = $true
      $exit = 0
    }
    'replace' {
      if (-not $Pattern) { throw 'Pattern is required for replace.' }
      if ($null -eq $Replacement) { throw 'Replacement is required for replace.' }
      $options = [System.Text.RegularExpressions.RegexOptions]::None
      if (-not $CaseSensitive) { $options = $options -bor [System.Text.RegularExpressions.RegexOptions]::IgnoreCase }
      if ($Multiline) { $options = $options -bor [System.Text.RegularExpressions.RegexOptions]::Multiline }
      if ($Singleline) { $options = $options -bor [System.Text.RegularExpressions.RegexOptions]::Singleline }
      $rx = $null
      if ($Regex) { $rx = [System.Text.RegularExpressions.Regex]::new($Pattern, $options) }
      foreach ($f in $targets) {
        if (Get-Date -gt $deadline) { throw "Timed out after $TimeoutSec seconds." }
        $files += $f
        try { $text = Read-AllTextAuto -Path $f } catch { continue }
        $new = $null; $replCount = 0
        if ($Regex) {
          $new = $rx.Replace($text, { param($m) $script:tmpCount = $script:tmpCount + 1; return $Replacement })
          # count using Matches
          $replCount = ($rx.Matches($text)).Count
        } else {
          $replCount = ([regex]::Escape($Pattern) -split '\\1').Count; # dummy init
          $parts = $text.Split($Pattern)
          $replCount = if ($parts.Length -gt 1) { $parts.Length - 1 } else { 0 }
          $new = ($parts -join $Replacement)
        }
        if ($replCount -gt 0) {
          $totalReplacements += $replCount
          $changedFiles += @{ file=$f; replacements=$replCount }
          if (-not $DryRun) {
            if ($Backup) { Copy-Item -LiteralPath $f -Destination ($f + '.bak') -Force -ErrorAction SilentlyContinue }
            Write-TextWithEncoding -Path $f -Text $new -Encoding 'utf8'
          }
        }
      }
      $success = $true
      $exit = 0
    }
    'newline' {
      if (-not $NewLine) { throw 'NewLine is required: LF or CRLF.' }
      foreach ($f in $targets) {
        if (Get-Date -gt $deadline) { throw "Timed out after $TimeoutSec seconds." }
        $files += $f
        try { $text = Read-AllTextAuto -Path $f } catch { continue }
        $converted = Apply-NewLine -Text $text -NewLine $NewLine
        if (-not $DryRun) { Write-TextWithEncoding -Path $f -Text $converted -Encoding 'utf8' }
        $changedFiles += @{ file=$f; newLine=$NewLine }
      }
      $success = $true
      $exit = 0
    }
    'encoding' {
      if (-not $ToEncoding) { throw 'ToEncoding is required.' }
      foreach ($f in $targets) {
        if (Get-Date -gt $deadline) { throw "Timed out after $TimeoutSec seconds." }
        $files += $f
        try { $text = Read-AllTextAuto -Path $f } catch { continue }
        if (-not $DryRun) { Write-TextWithEncoding -Path $f -Text $text -Encoding $ToEncoding }
        $changedFiles += @{ file=$f; toEncoding=$ToEncoding }
      }
      $success = $true
      $exit = 0
    }
  }

  $ended = Get-Date
  $res = @{
    action    = $Action
    startedAt = $started.ToString('o')
    endedAt   = $ended.ToString('o')
    durationMs= [int]($ended - $started).TotalMilliseconds
    timeoutSec= $TimeoutSec
    log       = $outLog
    filesExamined = $files.Count
    changedFiles  = $changedFiles
    matches       = $matches
    totalReplacements = $totalReplacements
    success   = $success
    exitCode  = $exit
  }
  Write-JsonResult -Obj $res
  exit $exit
}
catch {
  $err = $_
  $res = @{
    action    = $Action
    startedAt = $started.ToString('o')
    endedAt   = (Get-Date).ToString('o')
    durationMs= [int]((Get-Date) - $started).TotalMilliseconds
    timeoutSec= $TimeoutSec
    log       = $outLog
    filesExamined = $files.Count
    changedFiles  = $changedFiles
    matches       = $matches
    totalReplacements = $totalReplacements
    success   = $false
    exitCode  = 2
    error     = ($err.Exception.Message ?? $err.ToString())
  }
  Write-JsonResult -Obj $res
  exit 2
}

