powertoys-headless
==================

Headless PowerShell wrapper for Microsoft PowerToys. Provides basic status/start/stop/restart actions and returns a single JSON object per run.

Quick start
- Status: `pwsh PowerToys-main/tools/powertoys-headless.ps1 -Action status`
- Start: `pwsh PowerToys-main/tools/powertoys-headless.ps1 -Action start -ToolPath "C:\\Program Files\\PowerToys\\PowerToys.exe"`
- Stop: `pwsh PowerToys-main/tools/powertoys-headless.ps1 -Action stop -Force`

Behavior
- Non-interactive: no prompts; reports processes and basic version info.
- Timeouts: light wait after start; stop/restart best-effort.
- Logs: process stdout/stderr captured to `%TEMP%/utilities/powertoys` when starting.
- Tool discovery: `$Env:POWERTOYS_EXE`, PATH (`PowerToys.exe`), or standard install paths.

Actions & fields
- `status`: returns `available`, `exe`, `version`, `running[]` (name,id,started).
- `start`: starts PowerToys; returns `running[]` after a short delay.
- `stop`: stops known PowerToys processes; returns `stopped[]` and remaining `running[]`.
- `restart`: stop then start; returns new `running[]`.

Notes
- PowerToys exposes no stable CLI for module automation; this wrapper focuses on background process management.

