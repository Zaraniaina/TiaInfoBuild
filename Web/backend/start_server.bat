@echo off
cd /d D:\Tia_info_projet\projet 2\TiaInfoBuild\Web\backend
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *uvicorn*" 2>nul
timeout /t 2 /nobreak >nul
echo Demarrage serveur sur port 8001...
start "uvicorn" /min D:\Tia_info_projet\projet 2\TiaInfoBuild\Web\backend\env\Scripts\python.exe -m uvicorn app.main:app --port 8001
timeout /t 8 /nobreak >nul
echo Serveur demarre.