param(
    [switch]$NoWorker,
    [switch]$NoMock
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$dotnet = Join-Path $repoRoot 'tmp/dotnet10/dotnet.exe'
$node = Join-Path $repoRoot 'tmp/node/node-v20.19.5-win-x64/node.exe'
$webDir = Join-Path $repoRoot 'apps/web'
$webServe = Join-Path $webDir 'scripts/serve.mjs'

if (-not (Test-Path $dotnet)) {
    throw "Bundled dotnet SDK not found at $dotnet"
}

if (-not (Test-Path $node)) {
    throw "Bundled Node runtime not found at $node"
}

$logDir = Join-Path $repoRoot 'tmp/logs'
$stateDir = Join-Path $repoRoot 'tmp/run-state'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null

$apiLog = Join-Path $logDir 'api.log'
$workerLog = Join-Path $logDir 'worker.log'
$mockLog = Join-Path $logDir 'mock.log'
$webLog = Join-Path $logDir 'web.log'
$stateFile = Join-Path $stateDir 'local-stack.json'

function Start-BackgroundProcess {
    param(
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$LogFile,
        [string]$WorkingDirectory
    )

    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $FilePath
    $psi.Arguments = ($ArgumentList -join ' ')
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $process = [System.Diagnostics.Process]::Start($psi)
    if (-not $process) {
        throw "Failed to start process $FilePath"
    }

    $process | Out-Null
    return $process
}

function Wait-ForHttpEndpoint {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        }
        catch {
        }

        Start-Sleep -Seconds 1
    }

    return $false
}

function Stop-ProcessesOnPort {
    param(
        [int]$Port
    )

    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
    foreach ($connection in $connections) {
        if ($null -ne $connection.OwningProcess) {
            try {
                Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
                Write-Host "Stopped process $($connection.OwningProcess) using port $Port"
            }
            catch {
                Write-Host "Could not stop process $($connection.OwningProcess) using port $Port"
            }
        }
    }
}

$state = [ordered]@{}

Write-Host 'Clearing stale listeners on local ports...'
Stop-ProcessesOnPort -Port 5106
Stop-ProcessesOnPort -Port 5189
Stop-ProcessesOnPort -Port 4200

if (-not $NoMock) {
    Write-Host 'Starting OpenInvoice mock...'
    $mockProcess = Start-BackgroundProcess -FilePath $dotnet -ArgumentList @('run','--project','src/InvoiceLens.OpenInvoiceMock','--no-build') -LogFile $mockLog -WorkingDirectory $repoRoot
    $state['mock'] = $mockProcess.Id
}

Write-Host 'Starting API...'
$apiProcess = Start-BackgroundProcess -FilePath $dotnet -ArgumentList @('run','--project','src/InvoiceLens.Api','--no-build') -LogFile $apiLog -WorkingDirectory $repoRoot
$state['api'] = $apiProcess.Id

if (-not $NoWorker) {
    Write-Host 'Starting worker...'
    $workerProcess = Start-BackgroundProcess -FilePath $dotnet -ArgumentList @('run','--project','src/InvoiceLens.Worker','--no-build') -LogFile $workerLog -WorkingDirectory $repoRoot
    $state['worker'] = $workerProcess.Id
    if (Wait-ForHttpEndpoint -Url 'http://localhost:5106/health' -TimeoutSeconds 20) {
        Write-Host 'Worker startup check: API responded, worker process is running.'
    } else {
        Write-Host 'Worker startup check: API did not respond in time; check the worker log.'
    }
}

Write-Host 'Starting web app...'
$webProcess = Start-BackgroundProcess -FilePath $node -ArgumentList @($webServe) -LogFile $webLog -WorkingDirectory $webDir
$state['web'] = $webProcess.Id

$state | ConvertTo-Json | Set-Content -Path $stateFile -Encoding UTF8

Write-Host ''
Write-Host 'InvoiceLens stack started.'
Write-Host 'OpenInvoice mock: http://localhost:5189/health'
Write-Host 'API: http://localhost:5106/health'
Write-Host 'Web: http://localhost:4200'
Write-Host 'Logs:'
Write-Host "  $apiLog"
Write-Host "  $workerLog"
Write-Host "  $mockLog"
Write-Host "  $webLog"
Write-Host ''
Write-Host 'Use scripts/stop-local-stack.ps1 to stop everything.'
