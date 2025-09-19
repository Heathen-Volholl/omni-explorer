7zip-headless
================

Headless PowerShell wrapper that runs 7-Zip non-interactively with timeouts and JSON output, suitable for AI assistants and background automation.

Quick start
- Compress: `pwsh 7zip/tools/7zip-headless.ps1 -Action compress -Archive C:\\tmp\\data.7z -Source C:\\data -Format 7z`
- Extract: `pwsh 7zip/tools/7zip-headless.ps1 -Action extract -Archive C:\\tmp\\data.7z -OutDir C:\\out`
- List: `pwsh 7zip/tools/7zip-headless.ps1 -Action list -Archive C:\\tmp\\data.7z`
- Test: `pwsh 7zip/tools/7zip-headless.ps1 -Action test -Archive C:\\tmp\\data.7z`

Behavior
- Never prompts: passes `-y` and explicit overwrite mode.
- Timeouts: kills the process after `-TimeoutSec` (default 600s).
- JSON output: prints a single JSON object to STDOUT with result metadata; detailed logs written to temp dir.
- Tool discovery: uses `$Env:SEVENZIP_EXE` or finds `7z`/`7zz`/`7za` in `PATH`.

Parameters
- `-Action`: `compress|extract|list|test` (required)
- `-Archive`: target or source archive path (required except for some list/test variations)
- `-Source`: one or more source paths for `compress`
- `-OutDir`: destination folder for `extract` (auto-created)
- `-Format`: archive type for `compress` (e.g., `7z`, `zip`)
- `-Include`/`-Exclude`: patterns mapped to `-ir!` / `-xr!`
- `-Password`: optional password; enables header encryption for `compress`
- `-NoOverwrite`: skip existing files; default is overwrite
- `-TimeoutSec`: default 600
- `-ToolPath`: explicit path to 7-Zip executable
- `-LogDir`: where to write `.out.log` / `.err.log` (default `%TEMP%/utilities/7zip`)

JSON result fields
- `action, archive, sources, outDir, format`
- `startedAt, endedAt, durationMs`
- `exe, args, outLog, errLog`
- `exitCode, timedOut, success, error`

Notes
- Requires 7-Zip CLI available (7z/7zz/7za). Install 7-Zip and ensure it’s in PATH, or set `SEVENZIP_EXE`.
- The wrapper does not parse 7-Zip output; it provides structured metadata and log paths.
- For agents: treat non-zero `exitCode` or `timedOut=true` as failures.

