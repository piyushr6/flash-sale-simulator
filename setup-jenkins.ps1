# ─────────────────────────────────────────────────────────────────
# setup-jenkins.ps1
# Flash Sale — Jenkins Setup Script for Windows PowerShell
#
# Run this ONCE to set up Jenkins with Docker + kubectl.
# Usage:  .\setup-jenkins.ps1
# ─────────────────────────────────────────────────────────────────

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Flash Sale — Jenkins CI/CD Setup" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Verify Docker is running ─────────────────────────────
Write-Host "[1/6] Checking Docker..." -ForegroundColor Yellow
try {
    $dockerVer = docker version --format "{{.Client.Version}}" 2>&1
    Write-Host "      Docker OK: $dockerVer" -ForegroundColor Green
} catch {
    Write-Host "      ERROR: Docker is not running. Start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# ── Step 2: Verify Minikube is running ───────────────────────────
Write-Host "[2/6] Checking Minikube..." -ForegroundColor Yellow
$minikubeStatus = minikube status --format "{{.Host}}" 2>&1
if ($minikubeStatus -ne "Running") {
    Write-Host "      Minikube not running. Starting..." -ForegroundColor Yellow
    minikube start --driver=docker --cpus=3 --memory=5500mb
} else {
    Write-Host "      Minikube OK: Running" -ForegroundColor Green
}

# ── Step 3: Get Minikube kubeconfig path ─────────────────────────
Write-Host "[3/6] Locating kubeconfig..." -ForegroundColor Yellow
$kubeConfigPath = "$env:USERPROFILE\.kube\config"
if (-not (Test-Path $kubeConfigPath)) {
    Write-Host "      ERROR: kubeconfig not found at $kubeConfigPath" -ForegroundColor Red
    Write-Host "      Run: minikube start  first" -ForegroundColor Red
    exit 1
}
Write-Host "      kubeconfig found: $kubeConfigPath" -ForegroundColor Green

# ── Step 4: Create Jenkins data volume ───────────────────────────
Write-Host "[4/6] Creating Jenkins data volume..." -ForegroundColor Yellow
$volumeExists = docker volume ls --format "{{.Name}}" | Select-String "jenkins-flash-data"
if (-not $volumeExists) {
    docker volume create jenkins-flash-data | Out-Null
    Write-Host "      Volume created: jenkins-flash-data" -ForegroundColor Green
} else {
    Write-Host "      Volume already exists: jenkins-flash-data" -ForegroundColor Green
}

# ── Step 5: Build custom Jenkins image ───────────────────────────
Write-Host "[5/6] Building custom Jenkins image (includes Docker CLI + kubectl)..." -ForegroundColor Yellow
Write-Host "      This takes 3-5 minutes on first run..." -ForegroundColor Gray

# Convert Windows path to Docker-compatible path
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

docker build -t jenkins-flash-sale:latest ./jenkins/
if ($LASTEXITCODE -ne 0) {
    Write-Host "      ERROR: Jenkins image build failed" -ForegroundColor Red
    exit 1
}
Write-Host "      Jenkins image built: jenkins-flash-sale:latest" -ForegroundColor Green

# ── Step 6: Run Jenkins container ────────────────────────────────
Write-Host "[6/6] Starting Jenkins container..." -ForegroundColor Yellow

# Stop and remove existing container if present
$existing = docker ps -a --format "{{.Names}}" | Select-String "jenkins-flash"
if ($existing) {
    Write-Host "      Removing existing Jenkins container..." -ForegroundColor Gray
    docker stop jenkins-flash 2>&1 | Out-Null
    docker rm   jenkins-flash 2>&1 | Out-Null
}

# Convert kubeconfig path for Docker volume mount (Windows → Unix style)
$kubeConfigUnix = $kubeConfigPath -replace '\\', '/' -replace 'C:', '/c'

# Run Jenkins with:
#   - Docker socket mounted (so Jenkins can run docker build)
#   - kubeconfig mounted (so kubectl works inside Jenkins)
#   - Port 8090 (avoids conflict with our app on 8080)
#   - jenkins-flash-data volume for persistence
docker run -d `
    --name jenkins-flash `
    --restart unless-stopped `
    -p 8090:8080 `
    -p 50000:50000 `
    -v /var/run/docker.sock:/var/run/docker.sock `
    -v jenkins-flash-data:/var/jenkins_home `
    -v "${kubeConfigPath}:/root/.kube/config:ro" `
    --group-add 999 `
    jenkins-flash-sale:latest

if ($LASTEXITCODE -ne 0) {
    Write-Host "      ERROR: Failed to start Jenkins container" -ForegroundColor Red
    exit 1
}

# ── Wait for Jenkins to start ─────────────────────────────────────
Write-Host ""
Write-Host "Waiting for Jenkins to start (up to 90 seconds)..." -ForegroundColor Yellow
$started = $false
for ($i = 1; $i -le 18; $i++) {
    Start-Sleep -Seconds 5
    $health = docker inspect jenkins-flash --format "{{.State.Running}}" 2>&1
    if ($health -eq "true") {
        # Try HTTP
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:8090" -TimeoutSec 3 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($resp.StatusCode -lt 500) {
                $started = $true
                break
            }
        } catch { }
    }
    Write-Host "  Still starting... ($($i * 5)s)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  Jenkins is ready!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "  URL:       http://localhost:8090" -ForegroundColor Cyan
Write-Host "  User:      admin" -ForegroundColor Cyan
Write-Host "  Password:  see below" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Initial admin password:" -ForegroundColor Yellow
Write-Host ""
try {
    $initPassword = docker exec jenkins-flash cat /var/jenkins_home/secrets/initialAdminPassword 2>&1
    Write-Host "  $initPassword" -ForegroundColor White
} catch {
    Write-Host "  Run: docker exec jenkins-flash cat /var/jenkins_home/secrets/initialAdminPassword" -ForegroundColor White
}
Write-Host ""
Write-Host "  Next steps → see README.md: Jenkins Setup section" -ForegroundColor Gray
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
