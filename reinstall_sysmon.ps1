# SpyderXDR - Reinstall Sysmon with proper configuration
# Run this script as Administrator!
# Right-click -> "Run with PowerShell"

$ErrorActionPreference = "Stop"

Write-Host "=== SpyderXDR Sysmon Re-installation ===" -ForegroundColor Cyan
Write-Host ""

$sysmonPath = "$env:SystemRoot\Sysmon64.exe"
$configPath = "C:\Users\Vishaal\Desktop\SpyderXDR-updated\sysmon-config.xml"
$projectDir = "C:\Users\Vishaal\Desktop\SpyderXDR-updated"

# Check if Sysmon64.exe exists
if (-not (Test-Path $sysmonPath)) {
    Write-Host "ERROR: Sysmon64.exe not found at $sysmonPath" -ForegroundColor Red
    exit 1
}

# Check if config file exists
if (-not (Test-Path $configPath)) {
    Write-Host "ERROR: Config file not found at $configPath" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Stopping Sysmon service..." -ForegroundColor Yellow
Stop-Service Sysmon64 -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  Done" -ForegroundColor Green

Write-Host "Step 2: Uninstalling current Sysmon..." -ForegroundColor Yellow
Set-Location $projectDir
& $sysmonPath -u -AcceptEula -Force
Start-Sleep -Seconds 2
Write-Host "  Done" -ForegroundColor Green

Write-Host "Step 3: Reinstalling Sysmon with config..." -ForegroundColor Yellow
& $sysmonPath -i $configPath -AcceptEula
Start-Sleep -Seconds 3
Write-Host "  Done" -ForegroundColor Green

Write-Host ""
Write-Host "=== Verification ===" -ForegroundColor Cyan

# Check Sysmon service
$svc = Get-Service Sysmon64 -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq 'Running') {
    Write-Host "✅ Sysmon64 service: Running" -ForegroundColor Green
} else {
    Write-Host "❌ Sysmon64 service: NOT running ($($svc.Status))" -ForegroundColor Red
}

# Check Sysmon driver
$drv = Get-CimInstance Win32_SystemDriver -Filter "Name LIKE '%Sysmon%' OR Name LIKE '%SysmonDrv%'"
if ($drv) {
    Write-Host "✅ Sysmon kernel driver: $($drv.State)" -ForegroundColor Green
} else {
    Write-Host "❌ Sysmon kernel driver: NOT found" -ForegroundColor Red
}

# Check Sysmon events
try {
    $events = Get-WinEvent -LogName 'Microsoft-Windows-Sysmon/Operational' -MaxEvents 5 -ErrorAction SilentlyContinue
    if ($events) {
        Write-Host "✅ Sysmon event log has events! Latest events:" -ForegroundColor Green
        $events | Format-Table TimeCreated, Id, LevelDisplayName -AutoSize
    } else {
        Write-Host "⚠️  Sysmon event log exists but no events yet (wait a few seconds)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Could not read Sysmon event log: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Done! Real Sysmon security events should start flowing now." -ForegroundColor Cyan
