# Progress Log (Utilities Survey)

Date: 2025-09-19

## What I Reviewed
- Custom PowerShell wrappers under `utilities/*/tools` that expose headless automation entrypoints for third-party helpers (7-Zip, CrystalDiskInfo, FFmpeg, ImageMagick, Notepad++, PowerToys, SQLite).
- Focused on understanding available actions, required tooling, JSON payloads, and timeout/logging behavior for potential use inside the cloud file manager.

## Key Observations
- Every wrapper enforces non-interactive execution, surfaces a single JSON blob, and captures stdout/stderr to `%TEMP%/utilities/<tool>`.
- Tool discovery consistently supports either explicit parameters, environment variables, or searching `PATH`, which should simplify remote execution.
- Timeouts, structured error payloads, and optional dry-run safeguards (where applicable) make these scripts safe to invoke from an agent/controller layer.

## Utility Notes
- **utilities/7zip/tools/7zip-headless.ps1**: Compress, extract, list, and test archives with format selection, include/exclude globs, password handling, overwrite controls, and per-run logs.
- **utilities/CrystalDiskInfo-master/tools/crystaldiskinfo-headless.ps1**: Gathers disk metadata and SMART failure prediction via WMI; optionally shells out to CrystalDiskInfo for richer logs.
- **utilities/FFmpeg-master/tools/ffmpeg-headless.ps1**: Wraps ffprobe and ffmpeg for media probe, transcode, and thumbnail tasks with codec/bitrate/timing controls and parsed ffprobe JSON.
- **utilities/ImageMagick-main/tools/imagemagick-headless.ps1**: Provides identify/convert/thumbnail operations with resize, strip, quality, and metadata parsing from `magick`.
- **utilities/notepad-plus-plus-master/tools/notepadpp-headless.ps1**: Offers bulk find/replace (regex or literal), newline normalization, and encoding conversion with file targeting filters, dry-run, and backup support.
- **utilities/PowerToys-main/tools/powertoys-headless.ps1**: Manages PowerToys lifecycle (status/start/stop/restart) by resolving installed binaries and reporting running processes.
- **utilities/sqlite-master/tools/sqlite-headless.ps1**: Handles sqlite3 version/query/exec/import/export operations with mode control (json/csv), optional file output, and stdout JSON parsing.

## Open Questions / Next Steps
1. Decide which wrappers should be exposed directly inside the cloud file manager UI/API and define the minimum argument set per feature.
2. Map the JSON schemas into TypeScript interfaces so responses can be validated before agents consume them.
3. Prototype a controller service that normalizes process execution (timeouts, env vars) to reuse across all utilities.
4. Verify third-party binaries are bundled or discoverable in the deployment environment; document installation prerequisites.
5. Explore test coverage for edge cases (e.g., large archives, long-running ffmpeg jobs, sqlite import failures) to ensure predictable error handling.
