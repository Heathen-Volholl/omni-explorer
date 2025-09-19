notepadpp-headless
==================

Headless PowerShell utility providing Notepad++-style bulk text operations without a GUI. Outputs one JSON object per run with metadata, counts, matches, and a log path.

Quick start
- Find (regex): `pwsh notepad-plus-plus-master/tools/notepadpp-headless.ps1 -Action find -Root C:\\proj -Include "*.txt","*.md" -Pattern "TODO:(.+)" -Regex -MaxResults 100`
- Replace (literal): `pwsh notepad-plus-plus-master/tools/notepadpp-headless.ps1 -Action replace -Root C:\\proj -Include "*.js" -Pattern "var " -Replacement "let " -Backup`
- Newlines: `pwsh notepad-plus-plus-master/tools/notepadpp-headless.ps1 -Action newline -Paths C:\\proj\\README.md -NewLine LF`
- Encoding: `pwsh notepad-plus-plus-master/tools/notepadpp-headless.ps1 -Action encoding -Paths C:\\proj\\notes.txt -ToEncoding utf8`

Behavior
- Non-interactive: operates on files/directories; no GUI.
- Timeouts: enforces `-TimeoutSec` by checking elapsed time while processing.
- Logs: writes a simple `.out.log` to `%TEMP%/utilities/notepadpp` containing progress lines; path is included in JSON.

Targets
- Select files via `-Paths` (files or folders) and/or `-Root` with `-Include`/`-Exclude` wildcard patterns (e.g., `*.txt`).

Actions & parameters
- `find`: `-Pattern <str>` with flags `-Regex`, `-CaseSensitive`, `-Multiline`, `-Singleline`, and `-MaxResults`.
- `replace`: `-Pattern <str> -Replacement <str>` with the same regex flags, plus `-DryRun` and `-Backup` (.bak copies).
- `newline`: `-NewLine LF|CRLF` (in-place by default, respects `-DryRun`).
- `encoding`: `-ToEncoding utf8|utf8bom|utf16le|utf16be|ascii` (in-place by default, respects `-DryRun`).

Result JSON
- `filesExamined, changedFiles[], matches[], totalReplacements, success, exitCode, startedAt, endedAt, durationMs, log`.

Notes
- Encoding detection uses a simple BOM check; otherwise assumes UTF‑8.
- Newline conversion normalizes to LF then maps to CRLF when requested.

