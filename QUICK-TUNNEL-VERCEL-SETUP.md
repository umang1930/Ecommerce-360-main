# Automatically keep Vercel pointed at the Printer Hub

This project already polls the Printer Hub for each uploaded PDF's print status. The missing piece with a Cloudflare Quick Tunnel is that its `trycloudflare.com` address can change when the tunnel process restarts. This script starts the Quick Tunnel, updates the existing Vercel Production variable `VITE_PRINTER_AUTOMATION_URL`, and asks Vercel to rebuild the latest Production deployment with that value.

## One-time setup

1. Install Node.js and the Vercel CLI on the Windows PC:

   ```powershell
   npm install --global vercel
   ```

2. Open PowerShell in this Ecommerce project folder and sign in/link this folder to the same Vercel project that serves `ecommerce-360-main.vercel.app`:

   ```powershell
   vercel login
   vercel link
   ```

   When asked, choose the existing Ecommerce 360 Vercel project. This creates local `.vercel` link metadata (`project.json` or `repo.json`, depending on the CLI version); it does not add credentials to the source code.

3. Confirm `VITE_PRINTER_AUTOMATION_URL` already exists for the **Production** environment in Vercel. The script updates that variable. It uses the Vercel CLI login stored for the same Windows account; do not put an access token in this project.

4. Make sure the Printer Hub is running on `http://localhost:3000`, then start the script:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\quick-tunnel-vercel.ps1
   ```

   Keep the PowerShell process running. When the Quick Tunnel URL appears, the script updates Vercel and starts a Production redeployment. When `cloudflared` exits, it starts it again and repeats the update if the URL changes.

If `cloudflared.exe` is not on PATH, pass its full path:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\quick-tunnel-vercel.ps1 -CloudflaredExe "C:\path\to\cloudflared.exe"
```

## Start it automatically when Windows logs in

Use Windows **Task Scheduler** so the tunnel supervisor runs under the same Windows account that completed `vercel login`:

1. Open **Task Scheduler** → **Create Task**.
2. On **General**, select **Run only when user is logged on** and choose the same account used for `vercel login`.
3. On **Triggers**, add **At log on** for that account.
4. On **Actions**, choose **Start a program**:
   - Program: `powershell.exe`
   - Arguments: `-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "FULL_PATH_TO_THIS_PROJECT\scripts\quick-tunnel-vercel.ps1"`
5. Save the task. The Printer Hub and its print bridge must also start automatically and listen on port 3000.

The task is a supervisor for the **Quick Tunnel**. If you also installed the named `Cloudflared` Windows service from Cloudflare's tunnel-token page, that service is a separate named tunnel (and the screenshot showed it had no routes). Do not rely on that service for this Quick Tunnel URL. The script needs the Vercel CLI login available to the same Windows account, which is why Task Scheduler's interactive account option is used.

## What happens after a restart

`cloudflared tunnel --url http://localhost:3000` starts and prints a new public address. The script updates Vercel Production's `VITE_PRINTER_AUTOMATION_URL`, finds the latest Production deployment, and runs `vercel redeploy` against it. Vercel environment changes only apply to a new deployment, so the rebuild is required for this Vite variable.

The Vercel CLI may need to be signed in again if its stored login expires. Check the task's **History** and the script's console/log output if a tunnel or deployment does not recover. Cloudflared output logs are stored under `%LOCALAPPDATA%\PrinterHub\quick-tunnel`.
