$ErrorActionPreference = 'SilentlyContinue'

$ports = @(8081, 8082, 8083, 8084)

foreach ($port in $ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen

  foreach ($connection in $connections) {
    $processId = $connection.OwningProcess

    if ($processId -and $processId -ne 0) {
      Stop-Process -Id $processId -Force
    }
  }
}

Set-Location $PSScriptRoot

$cachePaths = @(
  ".expo",
  "node_modules\\.cache\\metro"
)

foreach ($cachePath in $cachePaths) {
  if (Test-Path $cachePath) {
    Remove-Item -Path $cachePath -Recurse -Force -ErrorAction SilentlyContinue
  }
}

npx expo start --web --host lan -c