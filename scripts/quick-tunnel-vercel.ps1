param(
  [string]$HubOrigin = "http://localhost:3000",
  [string]$CloudflaredExe = "cloudflared.exe",
  [int]$RestartDelaySeconds = 5
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$vercelProjectLink = Join-Path $projectRoot ".vercel\project.json"
$vercelRepoLink = Join-Path $projectRoot ".vercel\repo.json"

if (-not (Test-Path -LiteralPath $vercelProjectLink) -and -not (Test-Path -LiteralPath $vercelRepoLink)) {
  throw "This Ecommerce project is not linked to Vercel. In this folder, run 'vercel link' once, then start this script again."
}

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
  throw "Vercel CLI was not found. Install it with 'npm install --global vercel', then run 'vercel login'."
}

if (-not (Get-Command $CloudflaredExe -ErrorAction SilentlyContinue) -and -not (Test-Path -LiteralPath $CloudflaredExe)) {
  throw "cloudflared was not found. Install cloudflared or pass its full path with -CloudflaredExe."
}

$HubOrigin = $HubOrigin.TrimEnd("/")
$logDirectory = Join-Path $env:LOCALAPPDATA "PrinterHub\quick-tunnel"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$lastPublishedUrl = ""

function Publish-TunnelUrl([string]$TunnelUrl) {
  Write-Host "Updating Vercel Production variable VITE_PRINTER_AUTOMATION_URL..."
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $TunnelUrl | & vercel env update VITE_PRINTER_AUTOMATION_URL production --type config --yes --cwd $projectRoot 2>&1 | ForEach-Object { Write-Host $_ }
    $updateExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($updateExitCode -ne 0) { throw "Vercel environment-variable update failed (exit code $updateExitCode)." }

  Write-Host "Finding the latest Production deployment..."
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $deploymentList = @(& vercel ls --prod --cwd $projectRoot 2>&1)
    $listExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($listExitCode -ne 0) { throw "Could not list Vercel Production deployments: $($deploymentList -join ' ')" }
  $matches = [regex]::Matches(($deploymentList -join "`n"), "https://[A-Za-z0-9.-]+\.vercel\.app")
  if ($matches.Count -eq 0) { throw "Could not find a Production deployment URL in 'vercel ls --prod' output." }
  $deploymentUrl = $matches[0].Value

  Write-Host "Redeploying $deploymentUrl with the new URL..."
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & vercel redeploy $deploymentUrl --target=production --no-wait --cwd $projectRoot 2>&1 | ForEach-Object { Write-Host $_ }
    $redeployExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($redeployExitCode -ne 0) { throw "Vercel redeploy failed (exit code $redeployExitCode)." }
  Write-Host "Vercel redeploy started. The tunnel URL is $TunnelUrl"
}

while ($true) {
  while ($true) {
    try {
      Invoke-WebRequest -Uri $HubOrigin -UseBasicParsing -TimeoutSec 5 | Out-Null
      break
    } catch {
      Write-Host "Waiting for Printer Hub at $HubOrigin..."
      Start-Sleep -Seconds 5
    }
  }

  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $logPath = Join-Path $logDirectory "cloudflared-$stamp.log"

  Write-Host "Starting Cloudflare Quick Tunnel to $HubOrigin..."
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $CloudflaredExe tunnel --url $HubOrigin 2>&1 | ForEach-Object {
      $line = $_.ToString()
      Add-Content -LiteralPath $logPath -Value $line
      Write-Host $line

      $urlMatch = [regex]::Match($line, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
      if ($urlMatch.Success) {
        $tunnelUrl = $urlMatch.Value.TrimEnd("/")
        if ($tunnelUrl -ne $lastPublishedUrl) {
          Write-Host "Quick Tunnel is available: $tunnelUrl"
          try {
            Publish-TunnelUrl $tunnelUrl
            $lastPublishedUrl = $tunnelUrl
          } catch {
            Write-Warning $_
            Write-Host "Vercel update failed; it will retry if cloudflared prints the URL again after restarting."
          }
        }
      }
    }
  } finally {
    $ErrorActionPreference = $previousPreference
  }

  Write-Warning "cloudflared stopped. Restarting it in $RestartDelaySeconds seconds."
  Start-Sleep -Seconds $RestartDelaySeconds
}
