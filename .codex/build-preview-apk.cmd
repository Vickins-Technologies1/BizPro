@echo off
setlocal enabledelayedexpansion

set "PATH=C:\Program Files\nodejs;%PATH%"
set "REPO_ROOT=C:\Users\ABCD\OneDrive\Documentos\BizPro"
set "REPO_ALIAS=%TEMP%\bizpro-build"
set "NODE_SHIM=%REPO_ALIAS%\apps\mobile\android\node.exe"

if exist "%REPO_ALIAS%" rmdir "%REPO_ALIAS%" >nul 2>&1
mklink /J "%REPO_ALIAS%" "%REPO_ROOT%" >nul 2>&1
if errorlevel 1 (
  echo Failed to create short repo alias.
  exit /b 1
)

if exist "%NODE_SHIM%" del /f /q "%NODE_SHIM%" >nul 2>&1
copy /Y "C:\Program Files\nodejs\node.exe" "%NODE_SHIM%" >nul 2>&1
if errorlevel 1 (
  rmdir "%REPO_ALIAS%" >nul 2>&1
  echo Failed to stage local node executable.
  exit /b 1
)

pushd "%REPO_ALIAS%\apps\mobile\android"
if errorlevel 1 (
  del /f /q "%NODE_SHIM%" >nul 2>&1
  rmdir "%REPO_ALIAS%" >nul 2>&1
  echo Failed to enter Android project directory.
  exit /b 1
)

call "%USERPROFILE%\.gradle\wrapper\dists\gradle-8.8-all\6gdy1pgp427xkqcjbxw3ylt6h\gradle-8.8\bin\gradle.bat" clean assembleRelease
set BUILD_EXIT=%ERRORLEVEL%

popd
del /f /q "%NODE_SHIM%" >nul 2>&1
rmdir "%REPO_ALIAS%" >nul 2>&1

exit /b %BUILD_EXIT%
