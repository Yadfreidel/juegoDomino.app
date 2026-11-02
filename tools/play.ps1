param([int]$Port=5091,[switch]$NoBrowser,[switch]$Restart)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$listener=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if($listener) {
    $running=Get-CimInstance Win32_Process -Filter ("ProcessId = "+$listener.OwningProcess)
    if(-not $running.CommandLine.Contains($taskRoot) -or -not $running.CommandLine.Contains('Domino.Desktop.dll')) { throw "El puerto $Port esta ocupado por otra app. Usa -Port con otro numero." }
    if(-not $Restart) {
        if(-not $NoBrowser) { Start-Process "http://127.0.0.1:$Port/" }
        Write-Output "App grafica ya disponible: http://127.0.0.1:$Port/"
        return
    }
    Stop-Process -Id $listener.OwningProcess
}
$sdk=Join-Path $taskRoot '.tools/dotnet/dotnet.exe'
if(-not(Test-Path -LiteralPath $sdk)) { $sdk='dotnet' }
$project=Join-Path $taskRoot 'src/Domino.Desktop'
$output=Join-Path $taskRoot ('.tools/desktop-build-'+[DateTime]::UtcNow.Ticks)
& $sdk build $project -c Release --nologo -o $output
if($LASTEXITCODE -ne 0) { throw 'No se pudo compilar la app gráfica.' }
$dll=Join-Path $output 'Domino.Desktop.dll'
$log=Join-Path $taskRoot '.tools/desktop.log'
$errorLog=Join-Path $taskRoot '.tools/desktop-error.log'
$process=Start-Process -FilePath $sdk -ArgumentList @(('"'+$dll+'"'),'--urls',"http://127.0.0.1:$Port") -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $errorLog -PassThru
Set-Content -LiteralPath (Join-Path $taskRoot '.tools/desktop.pid') -Value $process.Id
$ready=$false
for($attempt=0;$attempt -lt 40;$attempt++) {
    if($process.HasExited) { throw "El servidor no pudo iniciar. Consulta $errorLog" }
    try { $response=Invoke-WebRequest "http://127.0.0.1:$Port/" -UseBasicParsing; if($response.StatusCode -eq 200) { $ready=$true;break } } catch { Start-Sleep -Milliseconds 250 }
}
if(-not $ready) { throw 'El servidor no respondió a tiempo.' }
if(-not $NoBrowser) { Start-Process "http://127.0.0.1:$Port/" }
Write-Output "Mesa gráfica disponible: http://127.0.0.1:$Port/ (PID $($process.Id))"
