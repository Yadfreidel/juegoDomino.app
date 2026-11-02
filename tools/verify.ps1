$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$sdk=Join-Path $taskRoot '.tools/dotnet/dotnet.exe'
if(-not(Test-Path $sdk)) { $sdk='dotnet' }
& $sdk run --project (Join-Path $taskRoot 'tests/Domino.Tests') -c Release
if($LASTEXITCODE -ne 0) { throw 'Dominio falló' }
& $sdk run --project (Join-Path $taskRoot 'tests/Domino.Practice') -c Release
if($LASTEXITCODE -ne 0) { throw 'Práctica falló' }
& $sdk build (Join-Path $taskRoot 'src/Domino.Server') -c Release
if($LASTEXITCODE -ne 0) { throw 'Servidor no compila' }
& $sdk run --project (Join-Path $taskRoot 'tests/Domino.Integration') -c Release -- $taskRoot
if($LASTEXITCODE -ne 0) { throw 'Integración falló' }
