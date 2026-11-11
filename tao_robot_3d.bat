@echo off
chcp 65001 >nul
title Tao robot 3D bang Blender
cd /d "%~dp0"

set "BLENDER="
where blender >nul 2>nul && set "BLENDER=blender"
if not defined BLENDER (
  for /d %%D in ("%ProgramFiles%\Blender Foundation\Blender*") do (
    if exist "%%D\blender.exe" set "BLENDER=%%D\blender.exe"
  )
)
if not defined BLENDER (
  echo Khong tim thay Blender. Cai Blender tu https://www.blender.org/download/
  echo hoac mo Blender ^> Scripting ^> mo tao_robot_blender.py ^> Run Script.
  goto :end
)

echo Dang dung: %BLENDER%
"%BLENDER%" --background --python tao_robot_blender.py -- "%~dp0."
echo.
echo Xong. Mo lai trang web va bam "Xem trong 3D".

:end
pause
