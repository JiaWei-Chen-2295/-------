$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Resolve-Path (Join-Path $scriptDir "..")
$npmCmd = Join-Path $env:SystemRoot "System32\cmd.exe"

Push-Location $rootDir

try {
  $backend = Start-Process -FilePath $npmCmd -ArgumentList @("/c", "npm", "run", "dev:backend") -PassThru -NoNewWindow
  $frontend = Start-Process -FilePath $npmCmd -ArgumentList @("/c", "npm", "run", "dev:frontend") -PassThru -NoNewWindow

  while (-not $backend.HasExited -and -not $frontend.HasExited) {
    Start-Sleep -Seconds 1
    $backend.Refresh()
    $frontend.Refresh()
  }
}
finally {
  if ($backend -and -not $backend.HasExited) {
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
  }
  if ($frontend -and -not $frontend.HasExited) {
    Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
  }
  Pop-Location
}
