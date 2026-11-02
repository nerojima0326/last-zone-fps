@echo off
rem LAST ZONE - start local server and open the game in the default browser
start "LAST ZONE server" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8080
timeout /t 2 /nobreak >nul
start "" http://localhost:8080/
