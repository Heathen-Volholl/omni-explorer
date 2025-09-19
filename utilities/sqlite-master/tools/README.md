sqlite-headless
===============

Headless PowerShell wrapper for `sqlite3`. Runs queries and SQL scripts non-interactively, supports CSV import/export, enforces timeouts, and returns a single JSON object with run metadata.

Quick start
- Version: `pwsh sqlite-master/tools/sqlite-headless.ps1 -Action version`
- Query (JSON): `pwsh sqlite-master/tools/sqlite-headless.ps1 -Action query -Db app.db -Sql "select 1 as x" -Format json`
- Exec: `pwsh sqlite-master/tools/sqlite-headless.ps1 -Action exec -Db app.db -Sql "create table t(id integer)"`
- Import CSV: `pwsh sqlite-master/tools/sqlite-headless.ps1 -Action import -Db app.db -Csv data.csv -Table t -SkipHeader`
- Export CSV: `pwsh sqlite-master/tools/sqlite-headless.ps1 -Action export -Db app.db -Sql "select * from t" -Format csv -Output out.csv`

Behavior
- Non-interactive: never prompts; relies on exit codes and logs.
- Timeouts: kills `sqlite3` after `-TimeoutSec` (default 60s).
- Logs: stdout/stderr redirected under `%TEMP%/utilities/sqlite` (configurable via `-LogDir`).
- Tool discovery: `$Env:SQLITE_EXE` or `sqlite3` in PATH.

Actions & parameters
- `version`: returns sqlite3 version in `version`.
- `query`: `-Db <file>` and `-Sql <query>` or `-SqlFile <path>`; `-Format json|csv`; `-Output <file>` optional. Uses `.mode json|csv` with headers; includes `resultJson` when JSON.
- `exec`: `-Db <file>` and `-Sql <statement>` or `-SqlFile <path>`; for schema changes or DML.
- `import`: `-Db <file> -Csv <file> -Table <name> [-SkipHeader]`; uses `.mode csv` and `.import`.
- `export`: `-Db <file> -Sql <query> -Format json|csv -Output <file>`; copies captured stdout to `-Output`.

Notes
- JSON output requires sqlite3 with `.mode json` support (recent builds). If unavailable, omit `-Format json` or post-process CSV.

