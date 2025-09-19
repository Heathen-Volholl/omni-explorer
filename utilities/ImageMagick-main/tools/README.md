imagemagick-headless
====================

Headless PowerShell wrapper for ImageMagick (`magick`). Outputs one JSON object per run with metadata, exit code, timeout flag, and log paths. Designed for automation/AI.

Quick start
- Identify: `pwsh ImageMagick-main/tools/imagemagick-headless.ps1 -Action identify -Input C:\\images\\in.jpg`
- Convert: `pwsh ImageMagick-main/tools/imagemagick-headless.ps1 -Action convert -Input in.jpg -Output out.png -Strip -Quality 90`
- Thumbnail: `pwsh ImageMagick-main/tools/imagemagick-headless.ps1 -Action thumbnail -Input in.jpg -Output thumb.jpg -Width 640 -Height 640`

Behavior
- Non-interactive: never prompts; relies on exit codes and logs.
- Timeouts: kills `magick` after `-TimeoutSec` (default 600s).
- Logs: stdout/stderr redirected under `%TEMP%/utilities/imagemagick` (configurable via `-LogDir`).
- Tool discovery: `$Env:MAGICK_EXE` or `magick` in PATH.

Actions & parameters
- `identify`: `-Input`
  - Runs `magick identify -ping -format "%m|%w|%h|%z|%b"` and parses `{format,width,height,depth,size}` when available.
- `convert`: `-Input -Output [-Strip] [-Quality N] [-Resize WxH | -Width W -Height H] [-Extra ...] [-NoOverwrite]`
- `thumbnail`: `-Input -Output [-Strip] [-Quality N] [-Resize WxH | -Width W -Height H] [-Extra ...] [-NoOverwrite]`

Notes
- `-Resize` accepts standard geometry (e.g., `320x240`, `640x`, `x480`). If omitted, `-Width`/`-Height` build `WxH`.
- For complex conversions (profiles, colorspace, masks), pass via `-Extra` or extend the script.

