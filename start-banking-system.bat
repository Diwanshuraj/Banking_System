@echo off
title Bharat National Bank - Launcher
echo ====================================================
echo Starting Bharat National Bank on localhost...
echo ====================================================

set "TMP=%LOCALAPPDATA%\Temp"
set "TEMP=%LOCALAPPDATA%\Temp"
set "SPRING_PROFILES_ACTIVE=dev"
set "MAVEN_OPTS=-Djava.io.tmpdir=%LOCALAPPDATA%\Temp"

cd /d "%~dp0backend"
start "Banking Backend (Port 8080)" cmd /k ".\mvnw.cmd spring-boot:run"

echo Waiting for backend to initialize...
timeout /t 6 /nobreak >nul

cd /d "%~dp0frontend"
start "Banking Frontend (Port 5173)" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

start http://localhost:5173
start http://localhost:8080/portal/login

echo ====================================================
echo Both servers have been launched!
echo React App:      http://localhost:5173
echo Servlet Portal: http://localhost:8080/portal/login
echo ====================================================
pause
