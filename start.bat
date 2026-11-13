@echo off
rem LAST ZONE - start the server, then open the game once it is listening
start "LAST ZONE server" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8080 -OpenBrowser
