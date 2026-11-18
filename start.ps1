# =============================================================================
# SpyderXDR - Full Stack Startup Script (Windows PowerShell)
# =============================================================================
# Starts Docker, Zookeeper, Kafka, Postgres, Redis, Elasticsearch, Fluentd,
# Velociraptor Server, Velociraptor Client, Backend, Kafka Consumer, and Frontend.
# =============================================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = Get-Item $PSScriptRoot

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "          SpyderXDR - Starting All Services           " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""


# --- 3. Verify Node Modules ---
$FrontendDir = Join-Path $ProjectRoot "frontend"
if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "node_modules missing in frontend. Running npm install (this may take a minute)..." -ForegroundColor Yellow
    cd $FrontendDir
    & npm install --legacy-peer-deps
    cd $ProjectRoot
}

# --- 4. Launch Fluentd ---
Write-Host "Starting Fluentd in its own console..." -ForegroundColor Yellow
$FluentdConf = Join-Path $ProjectRoot "fluentd\spyderxdr.conf"
$FluentdCmd = "C:\opt\fluent\fluentd.bat -c `"$FluentdConf`""
Start-Process cmd.exe -ArgumentList "/c", "title SpyderXDR Fluentd && $FluentdCmd" -WorkingDirectory $ProjectRoot
Write-Host "Fluentd startup triggered [OK]" -ForegroundColor Green

# --- 5. Launch Velociraptor Server and Client (As Admin) ---
Write-Host "Launching Velociraptor Server and Client in Elevated Admin Prompts..." -ForegroundColor Yellow
$VeloDir = "C:\Velociraptor"
if (Test-Path $VeloDir) {
    # Server command
    $ServerCmd = "cd /d $VeloDir && velociraptor.exe.exe --config server.config.yaml frontend -v"
    Start-Process cmd.exe -ArgumentList "/c", "title SpyderXDR Velociraptor Server && $ServerCmd" -Verb RunAs
    Write-Host "Velociraptor Server starting (Admin Prompt requested) [OK]" -ForegroundColor Green

    # Client command
    $ClientCmd = "cd /d $VeloDir && velociraptor.exe.exe --config client.config.yaml client -v"
    Start-Process cmd.exe -ArgumentList "/c", "title SpyderXDR Velociraptor Client && $ClientCmd" -Verb RunAs
    Write-Host "Velociraptor Client starting (Admin Prompt requested) [OK]" -ForegroundColor Green
} else {
    Write-Warning "Directory $VeloDir not found. Skipping Velociraptor startup."
}

# --- 6. Launch FastAPI Backend ---
Write-Host "Starting FastAPI Backend..." -ForegroundColor Yellow
$BackendDir = Join-Path $ProjectRoot "backend"
$BackendCmd = "cd /d `"$BackendDir`" && .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --ws websockets --reload"
Start-Process cmd.exe -ArgumentList "/c", "title SpyderXDR Backend && $BackendCmd" -WorkingDirectory $ProjectRoot
Write-Host "Backend API startup triggered [OK]" -ForegroundColor Green

# --- 7. Launch Kafka Consumer ---
Write-Host "Starting Kafka Consumer..." -ForegroundColor Yellow
$ConsumerCmd = "cd /d `"$BackendDir`" && .venv\Scripts\python.exe kafka_consumer.py"
Start-Process cmd.exe -ArgumentList "/c", "title SpyderXDR Kafka Consumer && $ConsumerCmd" -WorkingDirectory $ProjectRoot
Write-Host "Kafka Consumer startup triggered [OK]" -ForegroundColor Green

# --- 8. Launch React Frontend ---
Write-Host "Starting React Frontend..." -ForegroundColor Yellow
$FrontendCmd = "cd /d `"$FrontendDir`" && npm run dev"
Start-Process cmd.exe -ArgumentList "/c", "title SpyderXDR Frontend && $FrontendCmd" -WorkingDirectory $ProjectRoot
Write-Host "React Frontend startup triggered [OK]" -ForegroundColor Green

# --- 9. Launch Windows Agent ---
Write-Host "Starting Windows Agent..." -ForegroundColor Yellow
$AgentDir = Join-Path $ProjectRoot "agents\windows"
$AgentCmd = "cd /d `"$AgentDir`" && python agent.py"
Start-Process cmd.exe -ArgumentList "/c", "title SpyderXDR Windows Agent && $AgentCmd" -WorkingDirectory $ProjectRoot
Write-Host "Windows Agent startup triggered [OK]" -ForegroundColor Green

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "              SpyderXDR Running                       " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  Frontend   ->  http://localhost:3000" -ForegroundColor Cyan
Write-Host "  Backend    ->  http://localhost:8001" -ForegroundColor Cyan
Write-Host "  API Docs   ->  http://localhost:8001/docs" -ForegroundColor Cyan
Write-Host "  Velociraptor GUI -> https://localhost:8889" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Green
Write-Host "To stop all services, run: ./stop.ps1" -ForegroundColor Yellow
Write-Host ""
