$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$stateFile = Join-Path $repoRoot 'tmp/run-state/local-stack.json'

if (-not (Test-Path $stateFile)) {
    Write-Host 'No local stack is running.'
    exit 0
}

$state = Get-Content -Path $stateFile -Raw | ConvertFrom-Json
foreach ($key in @('mock','api','worker','web')) {
    if ($state.$key) {
        try {
            Stop-Process -Id ([int]$state.$key) -Force -ErrorAction SilentlyContinue
        } catch {}
    }
}

Remove-Item -Path $stateFile -Force -ErrorAction SilentlyContinue
Write-Host 'Stopped InvoiceLens local stack.'
