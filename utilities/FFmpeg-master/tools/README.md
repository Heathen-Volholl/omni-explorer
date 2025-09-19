ffmpeg-headless
================

Headless PowerShell wrapper for FFmpeg/FFprobe with structured JSON output, timeouts, and log files. Suitable for background automation and AI agents.

Quick start
- Probe: `pwsh FFmpeg-master/tools/ffmpeg-headless.ps1 -Action probe -Input C:\\media\\in.mp4`
- Transcode: `pwsh FFmpeg-master/tools/ffmpeg-headless.ps1 -Action transcode -Input in.mp4 -Output out.mp4 -VideoCodec libx264 -Crf 23 -Preset veryfast`
- Thumbnail: `pwsh FFmpeg-master/tools/ffmpeg-headless.ps1 -Action thumbnail -Input in.mp4 -Ss 00:00:03.500 -Vf "scale=640:-2" -Output out.jpg`

Behavior
- Non-interactive: passes `-nostdin` and explicit overwrite mode (`-y` or `-n`).
- Timeouts: kills the process after `-TimeoutSec` (default 900s).
- JSON: prints one JSON object to STDOUT with metadata and, for `probe`, parses ffprobe JSON into `ffprobe` field when available.
- Logs: stdout/stderr redirected under `%TEMP%/utilities/ffmpeg` (configurable via `-LogDir`).
- Tool discovery: uses `$Env:FFMPEG_EXE`/`$Env:FFPROBE_EXE` or finds `ffmpeg`/`ffprobe` in `PATH`.

Actions & parameters
- `probe`: `-Input`
  - Runs `ffprobe -print_format json -show_format -show_streams` and parses output.
- `transcode`: `-Input -Output [-VideoCodec] [-AudioCodec] [-Crf] [-Preset] [-VideoBitrate] [-AudioBitrate] [-Vf] [-Af] [-Ss] [-T] [-Extra] [-NoOverwrite]`
- `thumbnail`: `-Input -Output [-Ss] [-Vf] [-NoOverwrite]` (captures one frame, `-q:v 2`).

Notes
- This wrapper does not attempt to parse FFmpeg progress; rely on exit codes and logs.
- For multi-step jobs (concat, stream copy maps, subtitles), pass additional switches via `-Extra` or extend the script.

