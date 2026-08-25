#!/usr/bin/env bash
# One-line installer for J.A.R.V.I.S. on a Raspberry Pi (or any Debian/Ubuntu-based Linux box).
#
#   curl -fsSL https://raw.githubusercontent.com/CoolBeanz1/ClaudeProjectos/main/install.sh | bash
#
# Installs Node.js and Ollama if missing, pulls a small default model, clones/updates this repo,
# and sets up a systemd service so the JARVIS web interface starts on boot and restarts on crash.
#
# Safe to re-run: it skips steps that are already done and just updates the code + restarts services.
#
# Optional environment variables (export before running, or edit .env afterward):
#   JARVIS_DIR      - install directory (default: $HOME/jarvis)
#   JARVIS_MODEL    - Ollama model to pull (default: llama3.2:1b, a good fit for a Pi 5)
#   TELEGRAM_BOT_TOKEN        - if set, also installs + starts the Telegram bot service
#   TELEGRAM_ALLOWED_CHAT_ID  - restricts the Telegram bot to one chat ID

set -euo pipefail

REPO_URL="https://github.com/CoolBeanz1/ClaudeProjectos.git"
INSTALL_DIR="${JARVIS_DIR:-$HOME/jarvis}"
MODEL="${JARVIS_MODEL:-llama3.2:1b}"
RUN_USER="$(whoami)"

log() { echo "==> $1"; }

if [ "$(uname -s)" != "Linux" ]; then
  echo "This installer is for Linux (Raspberry Pi OS / Debian / Ubuntu). See README.md for other platforms." >&2
  exit 1
fi

# --- Node.js ---
NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
  if [ "$NODE_MAJOR" -ge 18 ]; then
    NEED_NODE=0
  fi
fi
if [ "$NEED_NODE" -eq 1 ]; then
  log "Installing Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  log "Node.js $(node -v) already installed."
fi

# --- git ---
if ! command -v git >/dev/null 2>&1; then
  log "Installing git..."
  sudo apt-get update && sudo apt-get install -y git
fi

# --- Ollama ---
if ! command -v ollama >/dev/null 2>&1; then
  log "Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
else
  log "Ollama already installed."
fi

log "Pulling model '$MODEL' (this can take a while on first run)..."
ollama pull "$MODEL"

# --- Clone or update JARVIS ---
if [ -d "$INSTALL_DIR/.git" ]; then
  log "Updating existing JARVIS install at $INSTALL_DIR..."
  git -C "$INSTALL_DIR" pull --ff-only
else
  log "Cloning JARVIS into $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
log "Installing dependencies..."
npm install

log "Installing the 'jarvis' command..."
chmod +x "$INSTALL_DIR/bin/jarvis.js"
JARVIS_BIN_TARGET="/usr/local/bin/jarvis"
sudo ln -sf "$INSTALL_DIR/bin/jarvis.js" "$JARVIS_BIN_TARGET"

# --- .env (only created if missing, never overwritten) ---
if [ ! -f "$INSTALL_DIR/.env" ]; then
  log "Writing $INSTALL_DIR/.env"
  cat > "$INSTALL_DIR/.env" <<EOF
JARVIS_MODEL=$MODEL
JARVIS_PERSONA=true
PORT=3000
OLLAMA_HOST=http://127.0.0.1:11434
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
TELEGRAM_ALLOWED_CHAT_ID=${TELEGRAM_ALLOWED_CHAT_ID:-}
EOF
fi

# Load .env so a token hand-edited in there (not just an exported env var) is picked up below
set -a
# shellcheck disable=SC1091
source "$INSTALL_DIR/.env"
set +a

NPM_PATH="$(command -v npm)"

# --- systemd: web service ---
log "Installing jarvis-web systemd service..."
sudo tee /etc/systemd/system/jarvis-web.service > /dev/null <<EOF
[Unit]
Description=J.A.R.V.I.S. web/PWA interface
After=network-online.target ollama.service
Wants=network-online.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$NPM_PATH start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now jarvis-web

# --- systemd: telegram bot service (only if a token was provided) ---
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
  log "Installing jarvis-telegram systemd service..."
  sudo tee /etc/systemd/system/jarvis-telegram.service > /dev/null <<EOF
[Unit]
Description=J.A.R.V.I.S. Telegram bot
After=network-online.target ollama.service
Wants=network-online.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$NPM_PATH run telegram
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable --now jarvis-telegram
fi

LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"

echo ""
log "Done."
echo "JARVIS web interface: http://${LAN_IP:-<this-device-ip>}:3000"
echo "  Check status: sudo systemctl status jarvis-web"
echo ""
echo "Try it right now from this terminal: jarvis"
echo "  jarvis status / jarvis model / jarvis memory  -  see 'jarvis help' for everything"
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ]; then
  echo "Telegram bot is running. Check status: sudo systemctl status jarvis-telegram"
else
  echo ""
  echo "No Telegram bot token was set, so only the web interface was started."
  echo "To add the Telegram bot later:"
  echo "  1. Message @BotFather on Telegram, send /newbot, copy the token it gives you"
  echo "  2. Edit $INSTALL_DIR/.env and set TELEGRAM_BOT_TOKEN=<your token>"
  echo "  3. Re-run this installer (bash install.sh, or the curl one-liner) to pick it up"
fi
