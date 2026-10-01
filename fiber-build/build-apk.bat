@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo ==============================================
echo   FiberReport 9.2 - Android APK Builder
echo ==============================================
echo.

set "TOOLS=%~dp0.build-tools"
set "SDK=%TOOLS%\android-sdk"
set "GRADLE=%TOOLS%\gradle-8.11.1"
set "JDK=%TOOLS%\jdk17"
set "ZIP=%TOOLS%\downloads"

if not exist "%TOOLS%" mkdir "%TOOLS%"
if not exist "%ZIP%" mkdir "%ZIP%"

where powershell >nul 2>&1
if errorlevel 1 (
  echo PowerShell is required on Windows.
  pause
  exit /b 1
)

call :getjdk
if errorlevel 1 goto :fail
call :getsdk
if errorlevel 1 goto :fail
call :getgradle
if errorlevel 1 goto :fail

set "JAVA_HOME=%JDK%"
set "PATH=%JDK%\bin;%SDK%\platform-tools;%PATH%"
set "GRADLE_HOME=%GRADLE%"

if not exist "%SDK%\platforms\android-35\android.jar" (
  echo Installing Android platform 35...
  "%SDK%\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root="%SDK%" "platforms;android-35" "build-tools;35.0.0"
  if errorlevel 1 goto :fail
)

echo.
echo Building APK...
echo.
call "%GRADLE%\bin\gradle.bat" --no-daemon clean assembleDebug
if errorlevel 1 goto :fail

if exist "app\build\outputs\apk\debug\app-debug.apk" (
  copy /y "app\build\outputs\apk\debug\app-debug.apk" "FiberReport_Modular_v9.2.apk" >nul
  echo.
  echo ==============================================
  echo APK CREATED SUCCESSFULLY
  echo ==============================================
  echo File: %~dp0FiberReport_Modular_v9.2.apk
  echo.
  echo You can copy this APK to your Android phone and install it.
  pause
  exit /b 0
)

echo APK was not found.
:fail
echo.
echo BUILD FAILED.
echo Check the error message above and run this file again.
pause
exit /b 1

:getjdk
if exist "%JDK%\bin\java.exe" exit /b 0
echo Downloading JDK 17 (about 180 MB)...
set "JDKZIP=%ZIP%\jdk17.zip"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse'; Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile '%JDKZIP%'"
if errorlevel 1 exit /b 1
if exist "%JDK%" rmdir /s /q "%JDK%"
mkdir "%JDK%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%JDKZIP%' -DestinationPath '%TOOLS%\jdk-extract' -Force; $d=Get-ChildItem '%TOOLS%\jdk-extract' -Directory | Select-Object -First 1; Copy-Item ($d.FullName+'\*') '%JDK%' -Recurse -Force"
if errorlevel 1 exit /b 1
exit /b 0

:getsdk
if exist "%SDK%\cmdline-tools\latest\bin\sdkmanager.bat" exit /b 0
echo Downloading Android SDK command-line tools...
set "SDKZIP=%ZIP%\cmdline-tools.zip"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip'; Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile '%SDKZIP%'"
if errorlevel 1 exit /b 1
if exist "%SDK%" rmdir /s /q "%SDK%"
mkdir "%SDK%\cmdline-tools"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%SDKZIP%' -DestinationPath '%SDK%\cmdline-tools-temp' -Force; Move-Item '%SDK%\cmdline-tools-temp\cmdline-tools' '%SDK%\cmdline-tools\latest' -Force"
if errorlevel 1 exit /b 1
(
  echo y
  echo y
  echo y
) | "%SDK%\cmdline-tools\latest\bin\sdkmanager.bat" --sdk_root="%SDK%" "platform-tools"
if errorlevel 1 exit /b 1
exit /b 0

:getgradle
if exist "%GRADLE%\bin\gradle.bat" exit /b 0
echo Downloading Gradle 8.11.1 (about 130 MB)...
set "GZIP=%ZIP%\gradle.zip"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='https://services.gradle.org/distributions/gradle-8.11.1-bin.zip'; Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile '%GZIP%'"
if errorlevel 1 exit /b 1
if exist "%GRADLE%" rmdir /s /q "%GRADLE%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%GZIP%' -DestinationPath '%TOOLS%' -Force"
if errorlevel 1 exit /b 1
exit /b 0
