# Registra el watcher AnimeAV1 en el Programador de tareas de Windows
# (al iniciar sesión). Ejecutar UNA vez en PowerShell:
#
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
#   .\scripts\register-animeav1-watch-task.ps1
#
# Quitar:
#   Unregister-ScheduledTask -TaskName "VeoTV-AnimeAV1-Watch" -Confirm:$false

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$cmd = Join-Path $PSScriptRoot "animeav1-watch.cmd"
$taskName = "VeoTV-AnimeAV1-Watch"

if (-not (Test-Path $cmd)) {
  throw "No existe $cmd"
}

$action = New-ScheduledTaskAction `
  -Execute "cmd.exe" `
  -Argument "/c `"$cmd`"" `
  -WorkingDirectory $repo

$trigger = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 5) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "VeoTV: escucha capitulos nuevos AnimeAV1 todo el dia (150 Mbps max)" `
  -Force | Out-Null

Write-Host "OK: tarea '$taskName' registrada (al iniciar sesion)."
Write-Host "Probar ahora: Start-ScheduledTask -TaskName '$taskName'"
Write-Host "O doble clic en: $cmd"
