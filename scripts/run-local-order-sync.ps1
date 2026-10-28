param(
  [string]$BaseUrl = "http://localhost:5175"
)

$ErrorActionPreference = "Stop"
$uri = "$($BaseUrl.TrimEnd('/'))/api/cron/sync-orders"
$logDirectory = Join-Path $PSScriptRoot "..\.local-data"
$logPath = Join-Path $logDirectory "local-order-sync.log"

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Write-Log([string]$message) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $message" | Add-Content -LiteralPath $logPath -Encoding UTF8
}

try {
  Write-Log "Starting request to $uri"
  $response = Invoke-RestMethod -Method Get -Uri $uri -TimeoutSec 600
  $json = $response | ConvertTo-Json -Depth 8 -Compress
  Write-Log "Response: $json"

  if ($response.errors -and $response.errors.Count -gt 0) {
    throw ($response.errors -join "; ")
  }
  Write-Log "Sync completed successfully."
} catch {
  $message = "Local order sync failed at $uri. Make sure the local app is running and database/API settings are configured. $($_.Exception.Message)"
  Write-Log $message
  Write-Error $message
  exit 1
}
