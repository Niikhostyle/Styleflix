@echo off
REM Daemon AnimeAV1: revisa capitulos nuevos en emision todo el dia.
REM Deja esta ventana abierta (o usa el Programador de tareas).
cd /d "%~dp0.."
title VeoTV AnimeAV1 Watch
echo.
echo  VeoTV - watcher AnimeAV1 (Ctrl+C para detener)
echo  Intervalo: 15 min ^| Tope red: 150 Mbps ^| Solo caps nuevos
echo.
call npm run animeav1:watch -- --out "G:\Mi unidad\veotv" --interval 15 --max-mbps 150 --pages 4
pause
