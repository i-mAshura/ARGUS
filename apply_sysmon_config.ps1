# SpyderXDR - Apply Sysmon Configuration
# Run this script as Administrator!
# Right-click -> "Run with PowerShell" (or Run as Administrator)

Write-Host "=== SpyderXDR Sysmon Configuration ===" -ForegroundColor Cyan
Write-Host ""

$sysmonPath = "$env:SystemRoot\Sysmon64.exe"
$configPath = "C:\Users\Vishaal\Desktop\SpyderXDR-updated\sysmon-config.xml"

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

Write-Host "Applying Sysmon configuration..." -ForegroundColor Yellow
Write-Host "  Binary: $sysmonPath"
Write-Host "  Config: $configPath"
Write-Host ""

# Apply the config
& $sysmonPath -c $configPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS: Sysmon configuration applied!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verify by running: Get-WinEvent -LogName 'Microsoft-Windows-Sysmon/Operational' -MaxEvents 5 | Format-Table TimeCreated, Id, Message -AutoSize" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You should now see EventID 1 (Process Creation), 3 (Network Connection), 7 (Image Loaded), 11 (File Create), etc." -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "WARNING: Command returned exit code $LASTEXITCODE" -ForegroundColor Red
    Write-Host "The config may not have been applied. Try restarting Sysmon:" -ForegroundColor Yellow
    Write-Host "  Stop-Service Sysmon64" -ForegroundColor Yellow
    Write-Host "  Start-Service Sysmon64" -ForegroundColor Yellow
}
