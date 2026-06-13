@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"

echo Starting Qdrant via Docker...
docker compose up -d qdrant
if errorlevel 1 (
  echo Failed to start Qdrant. Make sure Docker Desktop is running.
  exit /b 1
)

echo Starting backend...
start "" cmd /k ""%ROOT%\.venv\Scripts\python.exe" "%BACKEND_DIR%\main.py""

echo Starting frontend...
start "" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev"

echo.
echo All services are launching.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo Qdrant:   http://localhost:6333

endlocal
