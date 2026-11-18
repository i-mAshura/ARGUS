# ==============================================================================
# ARGUS XDR Platform - Windows Startup Task Installer
# ==============================================================================
# Automates registration of background tasks running at system boot.

# Ensure script is running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "❌ This installer must be run as Administrator."
    Exit
}

# Resolve target folders
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$backendDir = Join-Path $projectRoot "backend"
$frontendDir = Join-Path $projectRoot "frontend"

Write-Output "🚀 Configuring Windows Startup Services for ARGUS XDR..."
Write-Output "   Workspace Root: $projectRoot"

# Define task triggers
$trigger = New-ScheduledTaskTrigger -AtStartup

# Define Task principal (SYSTEM has rights to run without users logged on)
$principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# 1. Register Backend Scheduled Task
Write-Output "⚙️ Creating Task: ARGUS-Backend..."
$backendCmd = "cd '$backendDir'; .\.venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000"
$backendAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command `"$backendCmd`""

# Unregister task if it already exists to avoid collisions
Unregister-ScheduledTask -TaskName "ARGUS-Backend" -Confirm:$false -ErrorAction SilentlyContinue

$backendTask = Register-ScheduledTask -TaskName "ARGUS-Backend" -Action $backendAction -Trigger $trigger -Principal $principal -Description "Launches the ARGUS XDR FastAPI Server in background at boot."

# 2. Register Frontend Scheduled Task
Write-Output "⚙️ Creating Task: ARGUS-Frontend..."
$frontendCmd = "cd '$frontendDir'; npm run dev"
$frontendAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command `"$frontendCmd`""

# Unregister task if it already exists to avoid collisions
Unregister-ScheduledTask -TaskName "ARGUS-Frontend" -Confirm:$false -ErrorAction SilentlyContinue

$frontendTask = Register-ScheduledTask -TaskName "ARGUS-Frontend" -Action $frontendAction -Trigger $trigger -Principal $principal -Description "Launches the ARGUS XDR Frontend UI Dashboard in background at boot."

# Launch tasks immediately
Write-Output "▶️ Launching tasks immediately..."
Start-ScheduledTask -TaskName "ARGUS-Backend"
Start-ScheduledTask -TaskName "ARGUS-Frontend"

Write-Output "🎉 Windows Scheduled Tasks configured successfully!"
Write-Output "   Verify tasks using Task Scheduler under Task Scheduler Library."
Write-Output "   URL: http://localhost:3000"
