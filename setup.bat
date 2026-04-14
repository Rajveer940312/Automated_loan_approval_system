@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%" >nul

if /I not "%OS%"=="Windows_NT" (
    echo [ERROR] This installer is for Windows.
    echo [ERROR] Use setup.sh on macOS/Linux.
    popd >nul
    exit /b 1
)

net session >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Run this installer as Administrator only.
    echo [INFO] Right-click setup.bat and choose "Run as administrator".
    popd >nul
    exit /b 1
)

set "MODE="
set "AUTO_INSTALL=1"

:parse_args
if "%~1"=="" goto :args_done

if /I "%~1"=="--help" goto :help_ok
if /I "%~1"=="-h" goto :help_ok

if /I "%~1"=="local" (
    set "MODE=local"
    shift
    goto :parse_args
)

if /I "%~1"=="docker" (
    set "MODE=docker"
    shift
    goto :parse_args
)

if /I "%~1"=="all" (
    set "MODE=all"
    shift
    goto :parse_args
)

if /I "%~1"=="--no-auto-install" (
    set "AUTO_INSTALL=0"
    shift
    goto :parse_args
)

echo [ERROR] Unknown argument "%~1".
goto :help_error

:args_done
if not defined MODE set "MODE=all"

echo ==========================================
echo  FinTech-Approve AIO Installer
echo  OS: Windows
echo  Mode: %MODE%
if "%AUTO_INSTALL%"=="1" (
    echo  Auto install missing tools: enabled
) else (
    echo  Auto install missing tools: disabled
)
echo ==========================================
echo.

call :ensure_env_template || goto :fail

if /I "%MODE%"=="local" (
    call :ensure_python || goto :fail
    call :ensure_node || goto :fail
    call :setup_local || goto :fail
) else if /I "%MODE%"=="docker" (
    call :ensure_docker || goto :fail
    call :setup_docker || goto :fail
) else if /I "%MODE%"=="all" (
    call :ensure_python || goto :fail
    call :ensure_node || goto :fail
    call :ensure_docker || goto :fail
    call :setup_local || goto :fail
    call :setup_docker || goto :fail
) else (
    echo [ERROR] Invalid mode "%MODE%".
    goto :help_error
)

echo.
echo [SUCCESS] Setup completed.
echo [INFO] Local run:
echo        1. backend\.venv\Scripts\activate
echo        2. cd backend ^&^& uvicorn app:app --reload
echo        3. cd frontend ^&^& npm run dev
echo [INFO] Docker run:
echo        docker compose up --build
popd >nul
exit /b 0

:help_ok
echo Usage:
echo   setup.bat [local^|docker^|all] [--no-auto-install]
echo.
echo Examples:
echo   setup.bat local
echo   setup.bat docker
echo   setup.bat all
echo   setup.bat all --no-auto-install
popd >nul
exit /b 0

:help_error
echo Usage:
echo   setup.bat [local^|docker^|all] [--no-auto-install]
echo.
echo Examples:
echo   setup.bat local
echo   setup.bat docker
echo   setup.bat all
echo   setup.bat all --no-auto-install
popd >nul
exit /b 1

:ensure_env_template
if exist "backend\.env" (
    echo [OK] backend\.env already exists.
    exit /b 0
)

(
echo SUPABASE_URL=""
echo SUPABASE_KEY=""
) > "backend\.env"
echo [OK] Created backend\.env template.
exit /b 0

:refresh_common_paths
set "PATH=%PATH%;%LOCALAPPDATA%\Microsoft\WindowsApps;%LOCALAPPDATA%\Programs\Python\Python311;%LOCALAPPDATA%\Programs\Python\Python311\Scripts;%ProgramFiles%\Python311;%ProgramFiles%\Python311\Scripts;%ProgramFiles(x86)%\Python311;%ProgramFiles(x86)%\Python311\Scripts;C:\Program Files\nodejs;%ProgramFiles%\Docker\Docker\resources\bin;C:\ProgramData\chocolatey\bin;%USERPROFILE%\scoop\shims"
exit /b 0

:detect_windows_pkg_manager
set "WIN_PKG_MANAGER="
where winget >nul 2>nul
if not errorlevel 1 set "WIN_PKG_MANAGER=winget"

if not defined WIN_PKG_MANAGER (
    where choco >nul 2>nul
    if not errorlevel 1 set "WIN_PKG_MANAGER=choco"
)

if not defined WIN_PKG_MANAGER (
    where scoop >nul 2>nul
    if not errorlevel 1 set "WIN_PKG_MANAGER=scoop"
)

if not defined WIN_PKG_MANAGER (
    if "%AUTO_INSTALL%"=="1" (
        echo [WARN] No Windows package manager found. Attempting bootstrap ^(Chocolatey + Scoop^)...
        call :bootstrap_windows_pkg_managers
        call :refresh_common_paths

        where winget >nul 2>nul
        if not errorlevel 1 set "WIN_PKG_MANAGER=winget"

        if not defined WIN_PKG_MANAGER (
            where choco >nul 2>nul
            if not errorlevel 1 set "WIN_PKG_MANAGER=choco"
        )

        if not defined WIN_PKG_MANAGER (
            where scoop >nul 2>nul
            if not errorlevel 1 set "WIN_PKG_MANAGER=scoop"
        )
    )
)

if not defined WIN_PKG_MANAGER (
    echo [ERROR] Could not find winget/choco/scoop for automatic installation.
    echo [ERROR] Install winget or run setup.bat as Administrator to bootstrap choco/scoop.
    exit /b 1
)

echo [INFO] Using %WIN_PKG_MANAGER% for missing prerequisites.
exit /b 0

:bootstrap_windows_pkg_managers
call :install_choco_if_missing
call :install_scoop_if_missing
exit /b 0

:install_choco_if_missing
where choco >nul 2>nul
if not errorlevel 1 (
    echo [OK] Chocolatey already installed.
    exit /b 0
)

where powershell >nul 2>nul
if errorlevel 1 (
    echo [WARN] PowerShell not found. Cannot auto-install Chocolatey.
    exit /b 0
)

echo [INFO] Installing Chocolatey...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
if errorlevel 1 (
    echo [WARN] Chocolatey installation failed.
    exit /b 0
)

echo [OK] Chocolatey installed.
exit /b 0

:install_scoop_if_missing
where scoop >nul 2>nul
if not errorlevel 1 (
    echo [OK] Scoop already installed.
    exit /b 0
)

where powershell >nul 2>nul
if errorlevel 1 (
    echo [WARN] PowerShell not found. Cannot auto-install Scoop.
    exit /b 0
)

echo [INFO] Installing Scoop...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression"
if errorlevel 1 (
    echo [WARN] Scoop installation failed.
    exit /b 0
)

echo [OK] Scoop installed.
exit /b 0

:check_python
set "PYTHON_CMD="
set "PY_VER="
set "PY_MAJOR="
set "PY_MINOR="

for %%P in (py.exe python.exe) do (
    where %%P >nul 2>nul
    if not errorlevel 1 if not defined PYTHON_CMD (
        if /I "%%P"=="py.exe" (
            set "PYTHON_CMD=py -3"
        ) else (
            set "PYTHON_CMD=python"
        )
    )
)

if not defined PYTHON_CMD exit /b 1

for /f %%V in ('%PYTHON_CMD% -c "import sys; print(sys.version.split()[0])" 2^>nul') do set "PY_VER=%%V"
if not defined PY_VER exit /b 1

for /f "tokens=1,2 delims=." %%A in ("%PY_VER%") do (
    set "PY_MAJOR=%%A"
    set "PY_MINOR=%%B"
)

if !PY_MAJOR! LSS 3 exit /b 1
if !PY_MAJOR! EQU 3 if !PY_MINOR! LSS 10 exit /b 1

echo [OK] Python !PY_VER! detected via "%PYTHON_CMD%".
exit /b 0

:install_python
echo [INFO] Installing Python 3.11...
call :detect_windows_pkg_manager || exit /b 1

if /I "%WIN_PKG_MANAGER%"=="winget" (
    winget install -e --id Python.Python.3.11 --accept-package-agreements --accept-source-agreements --silent
    if errorlevel 1 (
        echo [ERROR] winget failed to install Python.
        exit /b 1
    )
) else if /I "%WIN_PKG_MANAGER%"=="choco" (
    choco install -y python --version=3.11.9
    if errorlevel 1 (
        echo [ERROR] choco failed to install Python.
        exit /b 1
    )
) else if /I "%WIN_PKG_MANAGER%"=="scoop" (
    scoop install python
    if errorlevel 1 (
        echo [ERROR] scoop failed to install Python.
        exit /b 1
    )
) else (
    echo [ERROR] Unsupported package manager.
    exit /b 1
)

call :refresh_common_paths
exit /b 0

:ensure_python
call :check_python
if not errorlevel 1 exit /b 0

if "%AUTO_INSTALL%"=="0" (
    echo [ERROR] Python 3.10+ is required but not available.
    exit /b 1
)

call :install_python || exit /b 1
call :check_python
if not errorlevel 1 exit /b 0

echo [ERROR] Python is still unavailable in this shell.
echo [ERROR] Open a new terminal and rerun setup.bat.
exit /b 1

:check_node
set "NODE_VER="
set "NODE_MAJOR="

where node >nul 2>nul
if errorlevel 1 exit /b 1

where npm >nul 2>nul
if errorlevel 1 exit /b 1

for /f %%V in ('node -p "process.versions.node" 2^>nul') do set "NODE_VER=%%V"
if not defined NODE_VER exit /b 1

for /f "tokens=1 delims=." %%A in ("%NODE_VER%") do set "NODE_MAJOR=%%A"
if !NODE_MAJOR! LSS 18 exit /b 1

echo [OK] Node.js !NODE_VER! and npm detected.
exit /b 0

:install_node
echo [INFO] Installing Node.js LTS...
call :detect_windows_pkg_manager || exit /b 1

if /I "%WIN_PKG_MANAGER%"=="winget" (
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
    if errorlevel 1 (
        echo [ERROR] winget failed to install Node.js.
        exit /b 1
    )
) else if /I "%WIN_PKG_MANAGER%"=="choco" (
    choco install -y nodejs-lts
    if errorlevel 1 (
        echo [ERROR] choco failed to install Node.js.
        exit /b 1
    )
) else if /I "%WIN_PKG_MANAGER%"=="scoop" (
    scoop install nodejs-lts
    if errorlevel 1 (
        echo [ERROR] scoop failed to install Node.js.
        exit /b 1
    )
) else (
    echo [ERROR] Unsupported package manager.
    exit /b 1
)

call :refresh_common_paths
exit /b 0

:ensure_node
call :check_node
if not errorlevel 1 exit /b 0

if "%AUTO_INSTALL%"=="0" (
    echo [ERROR] Node.js 18+ and npm are required but not available.
    exit /b 1
)

call :install_node || exit /b 1
call :check_node
if not errorlevel 1 exit /b 0

echo [ERROR] Node.js/npm are still unavailable in this shell.
echo [ERROR] Open a new terminal and rerun setup.bat.
exit /b 1

:check_docker_cli
set "COMPOSE_CMD="

where docker >nul 2>nul
if errorlevel 1 exit /b 1

docker compose version >nul 2>nul
if errorlevel 1 (
    where docker-compose >nul 2>nul
    if errorlevel 1 (
        exit /b 1
    ) else (
        set "COMPOSE_CMD=docker-compose"
    )
) else (
    set "COMPOSE_CMD=docker compose"
)

exit /b 0

:check_docker_daemon
docker version >nul 2>nul
if errorlevel 1 exit /b 1
exit /b 0

:install_docker
echo [INFO] Installing Docker Desktop...
call :detect_windows_pkg_manager || exit /b 1

if /I "%WIN_PKG_MANAGER%"=="winget" (
    winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements --silent
    if errorlevel 1 (
        echo [ERROR] winget failed to install Docker Desktop.
        exit /b 1
    )
) else if /I "%WIN_PKG_MANAGER%"=="choco" (
    choco install -y docker-desktop
    if errorlevel 1 (
        echo [ERROR] choco failed to install Docker Desktop.
        exit /b 1
    )
) else if /I "%WIN_PKG_MANAGER%"=="scoop" (
    scoop bucket add extras >nul 2>nul
    scoop install docker
    if errorlevel 1 (
        echo [ERROR] scoop failed to install Docker.
        exit /b 1
    )
) else (
    echo [ERROR] Unsupported package manager.
    exit /b 1
)

call :refresh_common_paths
exit /b 0

:ensure_docker
call :check_docker_cli
if errorlevel 1 (
    if "%AUTO_INSTALL%"=="0" (
        echo [ERROR] Docker and Docker Compose are required for docker mode.
        exit /b 1
    )
    call :install_docker || exit /b 1
    call :check_docker_cli
    if errorlevel 1 (
        echo [ERROR] Docker CLI/Compose still not available in this shell.
        echo [ERROR] Open a new terminal and rerun setup.bat.
        exit /b 1
    )
)

call :check_docker_daemon
if errorlevel 1 (
    echo [ERROR] Docker daemon is not reachable.
    echo [INFO] Start Docker Desktop and wait until it says "Engine running", then rerun setup.bat.
    exit /b 1
)

echo [OK] Docker CLI and daemon are ready.
exit /b 0

:setup_local
echo.
echo [STEP] Setting up local ^(non-Docker^) dependencies...

if not exist "backend\.venv\Scripts\python.exe" (
    echo [INFO] Creating backend virtual environment...
    %PYTHON_CMD% -m venv backend\.venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        exit /b 1
    )
) else (
    echo [OK] backend virtual environment already exists.
)

echo [INFO] Upgrading pip in backend virtual environment...
"backend\.venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 (
    echo [ERROR] Failed to upgrade pip.
    exit /b 1
)

echo [INFO] Installing backend Python dependencies...
"backend\.venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install backend dependencies.
    exit /b 1
)

if not exist "backend\model.joblib" (
    echo [INFO] backend\model.joblib not found. Training model...
    pushd backend >nul
    "..\backend\.venv\Scripts\python.exe" data_prep_and_train.py
    set "TRAIN_EXIT=!errorlevel!"
    popd >nul
    if not "!TRAIN_EXIT!"=="0" (
        echo [ERROR] Model training failed.
        exit /b 1
    )
) else (
    echo [OK] backend\model.joblib found.
)

echo [INFO] Installing frontend Node dependencies...
pushd frontend >nul
if exist "package-lock.json" (
    npm ci
) else (
    npm install
)
set "NPM_EXIT=!errorlevel!"
popd >nul
if not "!NPM_EXIT!"=="0" (
    echo [ERROR] Failed to install frontend dependencies.
    exit /b 1
)

echo [OK] Local dependencies installed.
exit /b 0

:setup_docker
echo.
echo [STEP] Setting up Docker dependencies...
echo [INFO] Building Docker image ^(this may take several minutes^)...
%COMPOSE_CMD% build
if errorlevel 1 (
    echo [ERROR] Docker build failed.
    exit /b 1
)

echo [OK] Docker dependencies are ready.
exit /b 0

:fail
echo.
echo [FAILED] Setup did not complete.
popd >nul
exit /b 1
