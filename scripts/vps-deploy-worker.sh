#!/usr/bin/env bash
# Deploy BaseForge worker on Ubuntu VPS (Node 22 + systemd).
# Usage:
#   DATABASE_URL='postgresql://...' ./scripts/vps-deploy-worker.sh
# Or create /home/ubuntu/.secrets/baseforge.env with DATABASE_URL=... first.

set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/baseforge-v1}"
SERVICE_NAME="baseforge-worker"
NODE_MAJOR=22

log() { echo "[vps-deploy] $*"; }

if [[ -f "$HOME/.secrets/baseforge.env" ]]; then
  # shellcheck disable=SC1090
  set -a && source "$HOME/.secrets/baseforge.env" && set +a
fi

install_node() {
  if command -v node >/dev/null 2>&1; then
    local v
    v=$(node -v | sed 's/v//' | cut -d. -f1)
    if [[ "$v" -ge 20 ]]; then
      log "Node $(node -v) already installed"
      return
    fi
  fi
  log "Installing Node.js ${NODE_MAJOR}..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | sudo -E bash -
  sudo apt-get install -y nodejs
  log "Node $(node -v) npm $(npm -v)"
}

clone_repo() {
  if [[ -d "$APP_DIR/.git" ]]; then
    log "Updating $APP_DIR"
    git -C "$APP_DIR" fetch origin main
    git -C "$APP_DIR" reset --hard origin/main
  else
    log "Cloning into $APP_DIR"
    git clone https://github.com/AmnAnon/baseforge-v1.git "$APP_DIR"
  fi
}

write_env() {
  local env_file="$APP_DIR/worker/.env"
  if [[ -z "${DATABASE_URL:-}" ]]; then
    log "ERROR: DATABASE_URL not set."
    log "Set DATABASE_URL env var or create $HOME/.secrets/baseforge.env"
    exit 1
  fi
  umask 077
  cat > "$env_file" <<EOF
DATABASE_URL=${DATABASE_URL}
METRICS_PORT=3001
NODE_ENV=production
EOF
  chmod 600 "$env_file"
  log "Wrote $env_file"
}

install_deps() {
  log "Installing worker dependencies..."
  cd "$APP_DIR/worker"
  npm ci
}

install_systemd() {
  log "Installing systemd unit..."
  sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" > /dev/null <<EOF
[Unit]
Description=BaseForge Background Worker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=${APP_DIR}/worker
EnvironmentFile=${APP_DIR}/worker/.env
ExecStart=${APP_DIR}/worker/node_modules/.bin/tsx index.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable "${SERVICE_NAME}"
}

start_service() {
  sudo systemctl restart "${SERVICE_NAME}"
  sleep 3
  if systemctl is-active --quiet "${SERVICE_NAME}"; then
    log "Service active"
  else
    log "Service failed — journal:"
    sudo journalctl -u "${SERVICE_NAME}" -n 30 --no-pager
    exit 1
  fi
}

verify_health() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3001/health || echo "000")
  if [[ "$code" == "200" ]]; then
    log "Health OK http://127.0.0.1:3001/health"
    curl -s http://127.0.0.1:3001/health
    echo ""
  else
    log "Health check failed HTTP $code"
    exit 1
  fi
}

main() {
  install_node
  clone_repo
  write_env
  install_deps
  install_systemd
  start_service
  verify_health
  log "Done. Set Vercel WORKER_URL=http://$(curl -s ifconfig.me):3001"
}

main "$@"