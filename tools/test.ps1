$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$sdk=Join-Path $taskRoot '.tools/dotnet/dotnet.exe'
if(-not(Test-Path $sdk)) { $sdk='dotnet' }
& $sdk run --project (Join-Path $taskRoot 'tests/Domino.Tests') -c Release
if($LASTEXITCODE -ne 0) { throw 'Pruebas fallidas' }
