param(
  [string]$HubOrigin = "http://localhost:3000",
  [string]$CloudflaredExe = "cloudflared.exe",
  [int]$RestartDelaySeconds = 5
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$vercelLink = Join-Path $projectRoot ".vercel\project.json"

if (-not (Test-Path -LiteralPath $vercelLink)) {
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
  $TunnelUrl | & vercel env update VITE_PRINTER_AUTOMATION_URL production --type config --yes --cwd $projectRoot
  if ($LASTEXITCODE -ne 0) { throw "Vercel environment-variable update failed (exit code $LASTEXITCODE)." }

  Write-Host "Finding the latest Production deployment..."
  $deploymentList = & vercel ls --prod --cwd $projectRoot 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Could not list Vercel Production deployments: $($deploymentList -join ' ')" }
  $matches = [regex]::Matches(($deploymentList -join "`n"), "https://[A-Za-z0-9.-]+\.vercel\.app")
  if ($matches.Count -eq 0) { throw "Could not find a Production deployment URL in 'vercel ls --prod' output." }
  $deploymentUrl = $matches[0].Value

  Write-Host "Redeploying $deploymentUrl with the new URL..."
  & vercel redeploy $deploymentUrl --target=production --no-wait --cwd $projectRoot
  if ($LASTEXITCODE -ne 0) { throw "Vercel redeploy failed (exit code $LASTEXITCODE)." }
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
  $stdoutPath = Join-Path $logDirectory "cloudflared-$stamp-out.log"
  $stderrPath = Join-Path $logDirectory "cloudflared-$stamp-error.log"

  Write-Host "Starting Cloudflare Quick Tunnel to $HubOrigin..."
  $tunnelProcess = Start-Process -FilePath $CloudflaredExe `
    -ArgumentList @("tunnel", "--url", $HubOrigin) `
    -PassThru -NoNewWindow `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath

  $publishedThisRun = $false
  while (-not $tunnelProcess.HasExited) {
    Start-Sleep -Seconds 2
    $logText = ""
    foreach ($path in @($stdoutPath, $stderrPath)) {
      if (Test-Path -LiteralPath $path) {
        try { $logText += [System.IO.File]::ReadAllText($path) + "`n" } catch { }
      }
    }

    $urlMatch = [regex]::Match($logText, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
    if ($urlMatch.Success) {
      $tunnelUrl = $urlMatch.Value.TrimEnd("/")
      if (-not $publishedThisRun -or $tunnelUrl -ne $lastPublishedUrl) {
        Write-Host "Quick Tunnel is available: $tunnelUrl"
        try {
          Publish-TunnelUrl $tunnelUrl
          $lastPublishedUrl = $tunnelUrl
          $publishedThisRun = $true
        } catch {
          Write-Warning $_
          Write-Host "Will retry Vercel update in 30 seconds while keeping the tunnel running."
          Start-Sleep -Seconds 30
        }
      }
    }
  }

  Write-Warning "cloudflared stopped. Restarting it in $RestartDelaySeconds seconds."
  Start-Sleep -Seconds $RestartDelaySeconds
}
