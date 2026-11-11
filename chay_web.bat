@echo off
chcp 65001 >nul
title HEHEHEHE
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  python chay_web.py
  goto :end
)
where py >nul 2>nul
if %errorlevel%==0 (
  py chay_web.py
  goto :end
)
echo Khong tim thay Python. Cai Python tu https://www.python.org roi chay lai file nay.

:end
pause
