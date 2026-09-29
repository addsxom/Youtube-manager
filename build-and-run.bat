@echo off
setlocal
cd /d "%~dp0"
title YTB Manager V2 - Production locale

if not exist ".venv\Scripts\python.exe" python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install -q -r requirements.txt

pushd frontend
if not exist node_modules call npm install
call npm run build
if errorlevel 1 (
  popd
  pause
  exit /b 1
)
popd

start "" http://127.0.0.1:8765
python main.py
