param([ValidateSet("start", "status")][string]$Action = "start")
$ErrorActionPreference = "Stop"

$port = 27018
$replicaSet = "diraFinancialTest"
$dataPath = Join-Path $env:LOCALAPPDATA "DiraOS\financial-test-mongo"
$mongod = if ($env:MONGOD_PATH) { $env:MONGOD_PATH } else { "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" }
$mongosh = (Get-Command mongosh -ErrorAction SilentlyContinue).Source
if (-not $mongosh) { $fallback = Join-Path $env:LOCALAPPDATA "Programs\mongosh\mongosh.exe"; if (Test-Path -LiteralPath $fallback) { $mongosh = $fallback } }
if (-not (Test-Path -LiteralPath $mongod)) { throw "mongod not found; set MONGOD_PATH to the MongoDB server executable" }
if (-not $mongosh) { throw "mongosh not found; install MongoDB Shell or add mongosh to PATH" }

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $listener -and $Action -eq "start") {
  New-Item -ItemType Directory -Force -Path $dataPath | Out-Null
  Start-Process -FilePath $mongod -ArgumentList @("--dbpath", $dataPath, "--replSet", $replicaSet, "--bind_ip", "127.0.0.1", "--port", "$port", "--logpath", (Join-Path $dataPath "mongod.log"), "--logappend") -WindowStyle Hidden | Out-Null
}

$adminUri = "mongodb://127.0.0.1:$port/admin"
$ready = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
  try {
    $statusJson = & $mongosh $adminUri --quiet --eval 'try { print(JSON.stringify({set:rs.status().set, primary:rs.status().myState===1})) } catch(e) { print(JSON.stringify({uninitialized:true})) }' 2>$null
    $status = $statusJson | ConvertFrom-Json
    if ($status.set -and $status.set -ne $replicaSet) { throw "Port $port is serving an unexpected MongoDB replica set" }
    if ($status.uninitialized) {
      & $mongosh $adminUri --quiet --eval 'rs.initiate({_id:"diraFinancialTest",members:[{_id:0,host:"127.0.0.1:27018"}]})' | Out-Null
    }
    if ($status.set -eq $replicaSet -and $status.primary) { $ready = $true; break }
  } catch {
    if ($_.Exception.Message -like "Port * unexpected*") { throw }
  }
  Start-Sleep -Seconds 1
}
if (-not $ready) { throw "Local MongoDB replica set did not become primary on 127.0.0.1:$port; inspect its local mongod.log" }
Write-Output "Isolated MongoDB replica set ready: $replicaSet on 127.0.0.1:$port"
Write-Output 'For the API database integration suite, run in the same PowerShell session:'
Write-Output '$env:MONGODB_TEST_URI = "mongodb://127.0.0.1:27018/vbo_financial_test_phase6b?replicaSet=diraFinancialTest"'
Write-Output 'pnpm --filter @vbo/api financial:concurrency-test'
