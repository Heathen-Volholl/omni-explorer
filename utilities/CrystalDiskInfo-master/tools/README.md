crystaldiskinfo-headless
========================

Headless PowerShell wrapper that reports disk health in JSON, suitable for automation/AI. It reads WMI/CIM for model/serial/size and failure prediction, and can optionally attempt to launch CrystalDiskInfo to generate logs.

Quick start
- Report: `pwsh CrystalDiskInfo-master/tools/crystaldiskinfo-headless.ps1 -Action report`

Behavior
- Non-interactive: never prompts; outputs a single JSON object to STDOUT.
- Timeouts: `-TimeoutSec` applies to the optional CrystalDiskInfo invocation only.
- JSON fields: `startedAt, endedAt, durationMs, exe, args, outLog, errLog, exitCode, timedOut, success, disks[]`.
- Disk fields: `index, model, serial, firmware, sizeBytes, interface, pnp, predictFailure, reason, healthStatus, temperatureC`.

Parameters
- `-Action`: `report|health` (default `report`; `health` currently identical to `report`).
- `-ToolPath`: path to `DiskInfo64.exe`/`CrystalDiskInfo.exe` if you want to run it; otherwise the script uses WMI only.
- `-TryExe`: attempt to locate the CrystalDiskInfo executable via PATH or `CRYSTALDISKINFO_EXE` (default true).
- `-TimeoutSec`: max seconds to wait for the optional process (default 60).
- `-LogDir`: where to write `.out.log` / `.err.log` if CrystalDiskInfo is invoked (default `%TEMP%/utilities/crystaldiskinfo`).

Notes
- SMART parsing is vendor-specific; this wrapper focuses on `PredictFailure` (from `MSStorageDriver_FailurePredictStatus`) and basic disk metadata.
- If CrystalDiskInfo is invoked, the wrapper uses a best-effort `/CopyExit` argument to keep it non-interactive; exact CLI switches vary by version and may be ignored.
- For richer SMART detail, consider a dedicated CLI like `smartctl`; this wrapper aims to provide a stable, headless baseline.

