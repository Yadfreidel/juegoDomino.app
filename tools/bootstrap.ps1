$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$tools=Join-Path $taskRoot '.tools'
New-Item -ItemType Directory -Force $tools | Out-Null
$installer=Join-Path $tools 'dotnet-install.ps1'
Invoke-WebRequest https://dot.net/v1/dotnet-install.ps1 -OutFile $installer
& $installer -Version 10.0.403 -InstallDir (Join-Path $tools 'dotnet') -NoPath
if($LASTEXITCODE -ne 0) { throw 'No se pudo instalar SDK' }
