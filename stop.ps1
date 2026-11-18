# =============================================================================
# SpyderXDR - Full Stack Shutdown Script (Windows PowerShell)
# =============================================================================
# Gracefully terminates all background services and shuts down Docker containers.
# =============================================================================

$ProjectRoot = Get-Item $PSScriptRoot

Write-Host ""
Write-Host "======================================================" -ForegroundColor Yellow
Write-Host "          SpyderXDR - Stopping All Services           " -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Yellow
Write-Host ""

# Helper to stop processes by command line matches
function Stop-ProcessByCommandLine {
    param(
        [string]$Pattern,
        [string]$Description
    )
    Write-Host "Stopping $Description..." -ForegroundColor Yellow
    $Processes = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*$Pattern*" }
    if ($Processes) {
        foreach ($Proc in $Processes) {
            try {
                Stop-Process -Id $Proc.ProcessId -Force -ErrorAction SilentlyContinue
                Write-Host "  Terminated PID $($Proc.ProcessId)" -ForegroundColor DarkGray
            } catch {
                Write-Warning "  Failed to stop PID $($Proc.ProcessId)"
            }
        }
        Write-Host "Stopped $Description [OK]" -ForegroundColor Green
    } else {
        Write-Host "$Description is not running." -ForegroundColor DarkGray
    }
}

# --- 1. Terminate Launched Host Processes ---
# React Frontend
Stop-ProcessByCommandLine -Pattern "vite" -Description "React Frontend (Vite)"
Stop-ProcessByCommandLine -Pattern "npm*run*dev" -Description "NPM launcher"

# FastAPI Backend
Stop-ProcessByCommandLine -Pattern "uvicorn app.main:app" -Description "FastAPI Backend"

# Kafka Consumer
Stop-ProcessByCommandLine -Pattern "kafka_consumer.py" -Description "Kafka Consumer"

# Fluentd
Stop-ProcessByCommandLine -Pattern "fluentd" -Description "Fluentd"

# Velociraptor Server and Client
Stop-ProcessByCommandLine -Pattern "velociraptor" -Description "Velociraptor Server and Client"

# Windows Agent
Stop-ProcessByCommandLine -Pattern "agents\windows\agent.py" -Description "Windows Agent"



Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "             All Services Stopped                     " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
