#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODE=""
AUTO_INSTALL=1
OS_LABEL=""
PKG_MANAGER=""
PYTHON_CMD=""
COMPOSE_CMD=()

usage() {
  cat <<'EOF'
Usage:
  ./setup.sh [local|docker|all] [--no-auto-install]

Examples:
  ./setup.sh local
  ./setup.sh docker
  ./setup.sh all
  ./setup.sh all --no-auto-install
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help)
        usage
        exit 0
        ;;
      local|docker|all)
        MODE="$1"
        ;;
      --no-auto-install)
        AUTO_INSTALL=0
        ;;
      *)
        echo "[ERROR] Unknown argument: $1"
        usage
        exit 1
        ;;
    esac
    shift
  done

  if [[ -z "$MODE" ]]; then
    MODE="all"
  fi
}

detect_os() {
  case "$(uname -s)" in
    Darwin)
      OS_LABEL="macOS"
      ;;
    Linux)
      OS_LABEL="Linux"
      ;;
    CYGWIN*|MINGW*|MSYS*)
      OS_LABEL="Windows-like shell"
      ;;
    *)
      OS_LABEL="Unknown"
      ;;
  esac
}

run_as_root() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
    return
  fi

  echo "[ERROR] Root privileges are required for package installation."
  echo "[ERROR] Install sudo or run this script as root."
  exit 1
}

detect_pkg_manager() {
  if [[ "$OS_LABEL" == "macOS" ]]; then
    PKG_MANAGER="brew"
    return
  fi

  if command -v apt-get >/dev/null 2>&1; then
    PKG_MANAGER="apt"
  elif command -v dnf >/dev/null 2>&1; then
    PKG_MANAGER="dnf"
  elif command -v yum >/dev/null 2>&1; then
    PKG_MANAGER="yum"
  elif command -v pacman >/dev/null 2>&1; then
    PKG_MANAGER="pacman"
  elif command -v zypper >/dev/null 2>&1; then
    PKG_MANAGER="zypper"
  else
    PKG_MANAGER=""
  fi

  if [[ -z "$PKG_MANAGER" ]]; then
    echo "[ERROR] Unsupported Linux package manager."
    echo "[ERROR] Supported: apt, dnf, yum, pacman, zypper."
    exit 1
  fi
}

ensure_homebrew() {
  if command -v brew >/dev/null 2>&1; then
    return
  fi

  if [[ "$AUTO_INSTALL" -ne 1 ]]; then
    echo "[ERROR] Homebrew is required on macOS for auto-install."
    exit 1
  fi

  echo "[INFO] Installing Homebrew..."
  if ! command -v curl >/dev/null 2>&1; then
    echo "[ERROR] curl is required to install Homebrew."
    exit 1
  fi

  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

ensure_env_template() {
  if [[ -f backend/.env ]]; then
    echo "[OK] backend/.env already exists."
    return
  fi

  cat > backend/.env <<'EOF'
SUPABASE_URL=""
SUPABASE_KEY=""
EOF
  echo "[OK] Created backend/.env template."
}

check_python() {
  PYTHON_CMD=""

  if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
  elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
  else
    return 1
  fi

  local py_ver py_major py_minor
  py_ver="$("$PYTHON_CMD" -c 'import sys; print(".".join(map(str, sys.version_info[:3])))' 2>/dev/null || true)"
  if [[ -z "$py_ver" ]]; then
    return 1
  fi

  py_major="${py_ver%%.*}"
  py_minor="${py_ver#*.}"
  py_minor="${py_minor%%.*}"

  if (( py_major < 3 || (py_major == 3 && py_minor < 10) )); then
    return 1
  fi

  echo "[OK] Python $py_ver detected via \"$PYTHON_CMD\"."
  return 0
}

install_python() {
  echo "[INFO] Installing Python 3.10+..."
  detect_pkg_manager

  case "$PKG_MANAGER" in
    brew)
      ensure_homebrew
      brew install python@3.11
      ;;
    apt)
      run_as_root apt-get update
      run_as_root apt-get install -y python3 python3-venv python3-pip
      ;;
    dnf)
      run_as_root dnf install -y python3 python3-pip python3-virtualenv
      ;;
    yum)
      run_as_root yum install -y python3 python3-pip
      ;;
    pacman)
      run_as_root pacman -Sy --noconfirm python python-pip
      ;;
    zypper)
      run_as_root zypper --non-interactive install python3 python3-pip python3-virtualenv
      ;;
    *)
      echo "[ERROR] Cannot install Python: unsupported package manager."
      exit 1
      ;;
  esac
}

ensure_python() {
  if check_python; then
    return
  fi

  if [[ "$AUTO_INSTALL" -ne 1 ]]; then
    echo "[ERROR] Python 3.10+ is required but missing or outdated."
    exit 1
  fi

  install_python
  hash -r

  if check_python; then
    return
  fi

  echo "[ERROR] Python is still unavailable in this shell."
  echo "[ERROR] Open a new terminal and rerun ./setup.sh."
  exit 1
}

check_node() {
  if ! command -v node >/dev/null 2>&1; then
    return 1
  fi
  if ! command -v npm >/dev/null 2>&1; then
    return 1
  fi

  local node_ver node_major
  node_ver="$(node -v 2>/dev/null | sed 's/^v//' || true)"
  if [[ -z "$node_ver" ]]; then
    return 1
  fi
  node_major="${node_ver%%.*}"

  if (( node_major < 18 )); then
    return 1
  fi

  echo "[OK] Node.js $node_ver and npm detected."
  return 0
}

install_node() {
  echo "[INFO] Installing Node.js 18+..."
  detect_pkg_manager

  case "$PKG_MANAGER" in
    brew)
      ensure_homebrew
      brew install node@20
      brew link --overwrite --force node@20 >/dev/null 2>&1 || true
      ;;
    apt)
      run_as_root apt-get update
      run_as_root apt-get install -y curl ca-certificates gnupg
      curl -fsSL https://deb.nodesource.com/setup_20.x | run_as_root bash -
      run_as_root apt-get install -y nodejs
      ;;
    dnf)
      run_as_root dnf install -y curl
      curl -fsSL https://rpm.nodesource.com/setup_20.x | run_as_root bash -
      run_as_root dnf install -y nodejs
      ;;
    yum)
      run_as_root yum install -y curl
      curl -fsSL https://rpm.nodesource.com/setup_20.x | run_as_root bash -
      run_as_root yum install -y nodejs
      ;;
    pacman)
      run_as_root pacman -Sy --noconfirm nodejs npm
      ;;
    zypper)
      run_as_root zypper --non-interactive install nodejs npm
      ;;
    *)
      echo "[ERROR] Cannot install Node.js: unsupported package manager."
      exit 1
      ;;
  esac
}

ensure_node() {
  if check_node; then
    return
  fi

  if [[ "$AUTO_INSTALL" -ne 1 ]]; then
    echo "[ERROR] Node.js 18+ and npm are required but missing or outdated."
    exit 1
  fi

  install_node
  hash -r

  if check_node; then
    return
  fi

  echo "[ERROR] Node.js/npm are still unavailable or below the required version."
  echo "[ERROR] Open a new terminal and rerun ./setup.sh."
  exit 1
}

check_docker_cli() {
  COMPOSE_CMD=()

  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi

  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
    return 0
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
    return 0
  fi

  return 1
}

check_docker_daemon() {
  docker version >/dev/null 2>&1
}

install_docker() {
  echo "[INFO] Installing Docker + Compose..."
  detect_pkg_manager

  case "$PKG_MANAGER" in
    brew)
      ensure_homebrew
      brew install --cask docker
      ;;
    apt)
      run_as_root apt-get update
      run_as_root apt-get install -y docker.io docker-compose-plugin || run_as_root apt-get install -y docker.io docker-compose
      run_as_root systemctl enable --now docker >/dev/null 2>&1 || true
      ;;
    dnf)
      run_as_root dnf install -y docker docker-compose-plugin || run_as_root dnf install -y docker docker-compose
      run_as_root systemctl enable --now docker >/dev/null 2>&1 || true
      ;;
    yum)
      run_as_root yum install -y docker docker-compose-plugin || run_as_root yum install -y docker docker-compose
      run_as_root systemctl enable --now docker >/dev/null 2>&1 || true
      ;;
    pacman)
      run_as_root pacman -Sy --noconfirm docker docker-compose
      run_as_root systemctl enable --now docker >/dev/null 2>&1 || true
      ;;
    zypper)
      run_as_root zypper --non-interactive install docker docker-compose
      run_as_root systemctl enable --now docker >/dev/null 2>&1 || true
      ;;
    *)
      echo "[ERROR] Cannot install Docker: unsupported package manager."
      exit 1
      ;;
  esac

  if [[ "$OS_LABEL" == "Linux" && "${EUID:-$(id -u)}" -ne 0 ]]; then
    if id -nG "$USER" | grep -qw docker; then
      true
    else
      run_as_root usermod -aG docker "$USER" >/dev/null 2>&1 || true
      echo "[INFO] Added $USER to docker group (if supported). You may need to log out/in."
    fi
  fi
}

ensure_docker() {
  if ! check_docker_cli; then
    if [[ "$AUTO_INSTALL" -ne 1 ]]; then
      echo "[ERROR] Docker and Compose are required for docker mode."
      exit 1
    fi
    install_docker
    hash -r
  fi

  if ! check_docker_cli; then
    echo "[ERROR] Docker CLI or Compose still unavailable."
    echo "[ERROR] Open a new terminal and rerun ./setup.sh."
    exit 1
  fi

  if ! check_docker_daemon; then
    echo "[ERROR] Docker daemon is not reachable."
    if [[ "$OS_LABEL" == "macOS" ]]; then
      echo "[INFO] Open Docker Desktop and wait for engine startup, then rerun ./setup.sh."
    else
      echo "[INFO] Start Docker service and rerun ./setup.sh."
    fi
    exit 1
  fi

  echo "[OK] Docker CLI and daemon are ready."
}

setup_local() {
  echo
  echo "[STEP] Setting up local (non-Docker) dependencies..."

  if [[ ! -x backend/.venv/bin/python ]]; then
    echo "[INFO] Creating backend virtual environment..."
    "$PYTHON_CMD" -m venv backend/.venv
  else
    echo "[OK] backend virtual environment already exists."
  fi

  echo "[INFO] Upgrading pip in backend virtual environment..."
  backend/.venv/bin/python -m pip install --upgrade pip

  echo "[INFO] Installing backend Python dependencies..."
  backend/.venv/bin/python -m pip install -r backend/requirements.txt

  if [[ ! -f backend/model.joblib ]]; then
    echo "[INFO] backend/model.joblib not found. Training model..."
    (
      cd backend
      ../backend/.venv/bin/python data_prep_and_train.py
    )
  else
    echo "[OK] backend/model.joblib found."
  fi

  echo "[INFO] Installing frontend Node dependencies..."
  (
    cd frontend
    if [[ -f package-lock.json ]]; then
      npm ci
    else
      npm install
    fi
  )

  echo "[OK] Local dependencies installed."
}

setup_docker() {
  echo
  echo "[STEP] Setting up Docker dependencies..."
  echo "[INFO] Building Docker image (this may take several minutes)..."
  "${COMPOSE_CMD[@]}" build
  echo "[OK] Docker dependencies are ready."
}

main() {
  parse_args "$@"
  detect_os

  echo "=========================================="
  echo " FinTech-Approve AIO Installer"
  echo " OS: $OS_LABEL"
  echo " Mode: $MODE"
  if [[ "$AUTO_INSTALL" -eq 1 ]]; then
    echo " Auto install missing tools: enabled"
  else
    echo " Auto install missing tools: disabled"
  fi
  echo "=========================================="
  echo

  if [[ "$OS_LABEL" == "Windows-like shell" ]]; then
    echo "[ERROR] This script is for macOS/Linux shells."
    echo "[ERROR] Use setup.bat on Windows."
    exit 1
  fi

  ensure_env_template

  case "$MODE" in
    local)
      ensure_python
      ensure_node
      setup_local
      ;;
    docker)
      ensure_docker
      setup_docker
      ;;
    all)
      ensure_python
      ensure_node
      ensure_docker
      setup_local
      setup_docker
      ;;
    *)
      echo "[ERROR] Invalid mode: $MODE"
      exit 1
      ;;
  esac

  echo
  echo "[SUCCESS] Setup completed."
  echo "[INFO] Local run:"
  echo "       1. source backend/.venv/bin/activate"
  echo "       2. cd backend && uvicorn app:app --reload"
  echo "       3. cd frontend && npm run dev"
  echo "[INFO] Docker run:"
  echo "       docker compose up --build"
}

main "$@"
