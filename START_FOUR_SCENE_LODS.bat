@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\generate_four_scene_lods.ps1"
exit /b %ERRORLEVEL%
