<#
.SYNOPSIS
    Resolves stuck CONFLICT outbox events in LodgeCoreOffline.db without a rebuild.

.DESCRIPTION
    When a sync conflict is force-resolved in the cloud Sync Centre, the desktop
    SyncEngine polls for the resolution and updates the in-memory status to RESOLVED
    but — due to a bug — never calls SaveChangesAsync, so the status reverts to
    CONFLICT on every restart. This script directly patches the SQLite row.

.PARAMETER EventId
    The specific outbox event ID to resolve (shown in the Sync Centre conflict detail).

.PARAMETER AggregateType
    Resolve ALL CONFLICT events for this aggregate type, e.g. "CITY_LEDGER".

.PARAMETER DryRun
    Show what would be changed without writing anything.

.EXAMPLE
    # Fix a specific event
    .\resolve-stuck-conflict.ps1 -EventId "dbccf986-fd6f-4a4c-97a3-cc0147c9d685"

    # Fix all stuck CITY_LEDGER conflicts
    .\resolve-stuck-conflict.ps1 -AggregateType "CITY_LEDGER"

    # Preview only
    .\resolve-stuck-conflict.ps1 -DryRun
#>

param(
    [string]$EventId       = "",
    [string]$AggregateType = "",
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Locate database ────────────────────────────────────────────────────────────
$dbPath = "$env:LOCALAPPDATA\LodgeCoreOffline.db"
if (-not (Test-Path $dbPath)) {
    Write-Error "Database not found at: $dbPath`nMake sure LodgeCore has been launched at least once on this machine."
    exit 1
}
Write-Host "Database : $dbPath" -ForegroundColor Cyan

# ── Obtain sqlite3.exe ─────────────────────────────────────────────────────────
$sqlite = (Get-Command sqlite3 -ErrorAction SilentlyContinue)?.Source
if (-not $sqlite) {
    $sqlite = "$env:TEMP\sqlite3.exe"
    if (-not (Test-Path $sqlite)) {
        Write-Host "sqlite3 not found. Downloading portable binary..." -ForegroundColor Yellow
        $zip = "$env:TEMP\sqlite3-tools.zip"
        Invoke-WebRequest `
            -Uri "https://www.sqlite.org/2024/sqlite-tools-win-x64-3460100.zip" `
            -OutFile $zip -UseBasicParsing
        Expand-Archive -Path $zip -DestinationPath "$env:TEMP\sqlite3-tools" -Force
        $bin = Get-ChildItem "$env:TEMP\sqlite3-tools" -Recurse -Filter "sqlite3.exe" | Select-Object -First 1
        if (-not $bin) { Write-Error "Could not extract sqlite3.exe"; exit 1 }
        Copy-Item $bin.FullName $sqlite -Force
        Write-Host "sqlite3 ready at $sqlite" -ForegroundColor Green
    }
}

function Invoke-Sqlite([string]$sql) {
    $out = & $sqlite $dbPath $sql 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Error "sqlite3 error: $out"; exit 1 }
    return $out
}

# ── Build WHERE clause ─────────────────────────────────────────────────────────
if ($EventId -and $AggregateType) {
    $where = "Id = '$EventId' AND AggregateType = '$AggregateType' AND Status = 'CONFLICT'"
} elseif ($EventId) {
    $where = "Id = '$EventId' AND Status = 'CONFLICT'"
} elseif ($AggregateType) {
    $where = "AggregateType = '$AggregateType' AND Status = 'CONFLICT'"
} else {
    $where = "Status = 'CONFLICT'"
}

# ── Preview affected rows ──────────────────────────────────────────────────────
Write-Host "`nConflicted events matching filter:" -ForegroundColor Yellow
$preview = Invoke-Sqlite ".headers on`n.mode column`nSELECT Id, AggregateType, EventType, AttemptCount, substr(LastError,1,60) AS LastError FROM OutboxEvents WHERE $where;"
if ($preview) { Write-Host $preview } else { Write-Host "  (none found)" -ForegroundColor Gray }

if ($DryRun) {
    Write-Host "`n[DRY RUN] No changes written." -ForegroundColor Yellow
    exit 0
}

if (-not $preview) {
    Write-Host "`nNo matching CONFLICT events found. Nothing to do." -ForegroundColor Green
    exit 0
}

# ── Apply fix ─────────────────────────────────────────────────────────────────
$ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$reason = "Manually resolved via resolve-stuck-conflict.ps1 — cloud conflict was FORCED by manager. Permanent fix: update to build containing SyncEngine SaveChangesAsync patch."

$updated = Invoke-Sqlite @"
UPDATE OutboxEvents
SET    Status        = 'RESOLVED',
       SyncedAt      = '$ts',
       NextAttemptAt = NULL,
       LastError     = '$reason'
WHERE  $where;
SELECT changes();
"@

Write-Host "`nRows updated: $updated" -ForegroundColor Green

# ── Verify ────────────────────────────────────────────────────────────────────
Write-Host "`nVerified state after patch:" -ForegroundColor Cyan
Invoke-Sqlite ".headers on`n.mode column`nSELECT Id, Status, SyncedAt FROM OutboxEvents WHERE LastError LIKE '%resolve-stuck-conflict%';"

Write-Host @"

Done. On the next LodgeCore sync cycle the CONFLICT badge will clear.
If the app is currently running, it will pick this up within ~30 seconds
without needing a restart.
"@ -ForegroundColor Green
