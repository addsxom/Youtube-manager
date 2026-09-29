@echo off
setlocal
cd /d "%~dp0"
title YTB Manager V2

where python >nul 2>nul || (
  echo [ERREUR] Python est introuvable dans le PATH.
  pause
  exit /b 1
)

where npm >nul 2>nul || (
  echo [ERREUR] Node.js / npm est introuvable dans le PATH.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [SETUP] Creation de l'environnement Python...
  python -m venv .venv
)

call .venv\Scripts\activate.bat
python -m pip install -q -r requirements.txt

if not exist "frontend\node_modules" (
  echo [SETUP] Installation du frontend...
  pushd frontend
  call npm install
  popd
)

echo.
echo [YTB Manager] Backend : http://127.0.0.1:8765
echo [YTB Manager] Frontend : http://127.0.0.1:5173

echo.
start "YTB Manager API" cmd /k "cd /d %~dp0 && call .venv\Scripts\activate.bat && python -m uvicorn backend.main:app --host 127.0.0.1 --port 8765 --reload"
start "YTB Manager Web" cmd /k "cd /d %~dp0frontend && npm run dev -- --host 127.0.0.1"

ping 127.0.0.1 -n 4 >nul
start "" http://127.0.0.1:5173
exit /b 0
