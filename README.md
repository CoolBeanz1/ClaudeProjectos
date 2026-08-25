# J.A.R.V.I.S.

A personal AI assistant, modeled after Iron Man's J.A.R.V.I.S., that runs **entirely on your own
PC** with **no cloud, no API keys, and no internet connection required**. Talk to it from your PC's
browser or from your phone as an installable app.

- 🧠 **Fully offline brain** — powered by a local LLM through [Ollama](https://ollama.com). Once the
  model is downloaded, JARVIS never calls out to the internet.
- 📱 **Phone + PC access** — it's an installable Progressive Web App (PWA). Add it to your phone's
  home screen and it looks and feels like a native app.
- 💬 **Optional Telegram bot** — talk to JARVIS from the Telegram app you already have on your phone
  and PC, from anywhere with a data connection, no shared wifi or VPN needed (see
  [Telegram bot](#telegram-bot) below).
- ⌨️ **A `jarvis` command** — one command gives you an interactive terminal chat, plus
  `jarvis status`/`model`/`memory` etc. (see [The `jarvis` CLI](#the-jarvis-cli) below).
- 🧵 **Long-term memory** — tell it `/remember <fact>` once and it recalls that fact in every future
  conversation, on every interface, not just within one chat's history.
- 🖐️ **Touch-first UI** — off-canvas navigation drawer, large tap targets, fixed bottom composer,
  safe-area aware for notched phones.
- 💾 **Local history** — conversations are stored as plain JSON files on your PC, never sent anywhere.
- 🥧 **One-line Raspberry Pi install** — run it 24/7 on a few watts instead of leaving your PC on (see
  [Running on a Raspberry Pi](#running-on-a-raspberry-pi-always-on) below).

## How it works

```
Phone (browser/PWA) ──HTTP (local network)──▶ PC running JARVIS server ──▶ Ollama (local LLM)
PC (browser/PWA)    ──HTTP (localhost)─────▶ PC running JARVIS server ──▶ Ollama (local LLM)
```

The "brain" (the LLM) runs 100% offline on your PC — no wifi or internet needed for JARVIS to think.
Your **phone** still needs *some* network path to reach your PC (see [Accessing from your phone](#accessing-from-your-phone)
below) — there's no way around a phone needing a network of some kind to talk to another device, but
that network never has to touch the internet.

## Requirements

- **Node.js 18+** on the machine that will run JARVIS — a PC, or a small always-on device like a
  Raspberry Pi (see [Running on a Raspberry Pi](#running-on-a-raspberry-pi-always-on) below).
- **[Ollama](https://ollama.com/download)** installed and running on that same machine.
- At least one local model pulled, e.g.:
  ```bash
  ollama pull llama3.2
  ```
  (Smaller/faster: `llama3.2:1b`. Better quality if your hardware can handle it: `llama3.1:8b`,
  `mistral`, `qwen2.5:7b`, etc.)

## Setup

```bash
npm install
npm start
```

You'll see something like:

```
J.A.R.V.I.S. is online at http://localhost:3000
Reachable from your phone (same network) at:
  http://192.168.1.42:3000
```

Open `http://localhost:3000` on the PC itself. That's it — JARVIS is running.

### Choosing a model

By default JARVIS uses `llama3.2`. Change it with an environment variable:

```bash
JARVIS_MODEL=mistral npm start
```

## Accessing from your phone

**Option A — Same wifi/LAN as your PC (simplest):**
Open the `http://192.168.x.x:3000` address printed when the server starts, in your phone's browser.
Then tap **Share → Add to Home Screen** (iOS) or the **install** prompt / menu → **Install app**
(Android/Chrome) to install it like a real app.

**Option B — Away from home, no shared wifi:**
A phone can't magically reach a PC with zero network at all — it needs either the same LAN, or a
tunnel back to it. The privacy-friendly way to do that without exposing your PC to the open internet
is a personal mesh VPN like [Tailscale](https://tailscale.com/) (free for personal use):

1. Install Tailscale on your PC and sign in.
2. Install the Tailscale app on your phone and sign in with the same account.
3. Use the Tailscale IP/hostname it gives your PC instead of the LAN IP, e.g. `http://jarvis-pc:3000`.

Your PC's model still does 100% of the thinking locally — Tailscale only carries the chat text back
and forth, it's not a cloud AI service.

> Do **not** port-forward 3000 directly on your router and expose it to the open internet — there's
> no authentication built in, and anyone could reach your assistant (and your PC's local network).

## Telegram bot

This gives you a "webpage-free" way to talk to JARVIS from your phone or PC using the Telegram app
you likely already have — no PWA install, no shared wifi, no Tailscale. Your PC still does 100% of
the actual thinking through Ollama; Telegram's servers only relay the text of your messages back and
forth, the same way any Telegram chat works.

1. **Create the bot** — in Telegram, message [@BotFather](https://t.me/BotFather), send `/newbot`,
   and follow the prompts. It gives you a token that looks like `123456789:AAExampleTokenHere`.
2. **Run the bot** on the same PC that's running Ollama:
   ```bash
   TELEGRAM_BOT_TOKEN=123456789:AAExampleTokenHere npm run telegram
   ```
3. **Message your bot** in Telegram and send `/start`. It replies with your numeric chat ID.
4. **Lock it to just you** (recommended — anyone who finds your bot's username could otherwise talk
   to it too). Stop the bot, then restart it with your chat ID set:
   ```bash
   TELEGRAM_BOT_TOKEN=123456789:AAExampleTokenHere TELEGRAM_ALLOWED_CHAT_ID=987654321 npm run telegram
   ```

Send `/reset` in the chat at any time to clear that conversation's history (long-term memory, covered
below, is separate and untouched by `/reset`). The bot polls Telegram for
new messages (no inbound port or public URL needed) and can run alongside `npm start` — they share
the same Ollama connection but keep separate conversation histories.

> Leave this running as a background process if you want it reachable at all times, since it only
> responds while the machine is awake and the process is running. See the next section for a way to
> run it as a proper always-on service.

## The `jarvis` CLI

Once dependencies are installed (`npm install`), a single `jarvis` command gives you a terminal-based
interface on top of everything above — handy for quickly chatting without opening a browser or
Telegram, and for managing JARVIS from the command line.

```bash
npm link          # makes the `jarvis` command available globally (one-time)
jarvis            # start an interactive chat right here in the terminal
```

(On a Pi set up with [the one-line installer](#one-line-install) below, `jarvis` is already on your
`PATH` — no `npm link` needed.)

| Command | What it does |
|---|---|
| `jarvis` / `jarvis chat` | Start an interactive chat in this terminal |
| `jarvis web` | Run the web/PWA server (same as `npm start`) |
| `jarvis telegram` | Run the Telegram bot (same as `npm run telegram`) |
| `jarvis model [name]` | Show the current model + locally available models, or switch models |
| `jarvis status` | Check Ollama connection, current model, persona, memory |
| `jarvis memory` | List everything JARVIS remembers long-term |
| `jarvis remember <fact>` | Save something to long-term memory |
| `jarvis forget <n\|all>` | Remove one memory entry (number from `jarvis memory`), or all |
| `jarvis reset` | Clear the CLI chat's own conversation history |
| `jarvis help` | Show all commands |

`jarvis model llama3.2:3b` writes the change to `.env`, so it takes effect the next time any
interface (CLI, web, or Telegram) starts — no need to remember an environment variable each time.

## Long-term memory

Every interface shares one long-term memory, stored in `data/memory.json` on your machine. Inside
*any* chat — CLI, web, or Telegram — the same slash commands work:

```
/remember I'm allergic to peanuts
/memory
/forget 1
/forget all
```

Facts you save are included in JARVIS's context for every future conversation on every interface, so
telling it something once in Telegram means it also knows it next time you open the web app or the
CLI. This is a simple, explicit memory (you decide what's remembered) rather than the kind of agent
that infers and files away facts on its own — reliable on a small local model, at the cost of needing
you to say `/remember` for things you want it to keep.

## Running on a Raspberry Pi (always-on)

Running JARVIS on a dedicated Raspberry Pi instead of your main PC means it's reachable 24/7 without
needing to leave your PC on — for a few watts of power instead of a whole desktop. A **Pi 5 (8GB)**
handles small models (`llama3.2:1b`, `qwen2.5:1.5b`) at a comfortable chat pace; larger models will
be slow since the Pi has no GPU for acceleration.

### One-line install

On a fresh Raspberry Pi OS (64-bit) install, SSH in and run:

```bash
curl -fsSL https://raw.githubusercontent.com/CoolBeanz1/ClaudeProjectos/main/install.sh | bash
```

This installs Node.js and Ollama if they're missing, pulls the `llama3.2:1b` model, clones this repo
to `~/jarvis`, sets up a systemd service (`jarvis-web`) so the web interface starts on boot and
restarts automatically if it ever crashes, and puts the [`jarvis` CLI](#the-jarvis-cli) on your `PATH`
so you can just type `jarvis` from any terminal on the Pi. It prints the URL to open when it's done.
It's safe to re-run any time (e.g. after a `git pull`-worthy update) — it skips what's already
installed.

To also stand up the Telegram bot as a service in the same step, export a bot token first (see
[Telegram bot](#telegram-bot) for how to get one from @BotFather):

```bash
export TELEGRAM_BOT_TOKEN=123456789:AAExampleTokenHere
curl -fsSL https://raw.githubusercontent.com/CoolBeanz1/ClaudeProjectos/main/install.sh | bash
```

Other options (export before running, or edit `~/jarvis/.env` afterward and re-run the installer to
apply changes):

| Variable | Default | Purpose |
|---|---|---|
| `JARVIS_DIR` | `~/jarvis` | Where to install |
| `JARVIS_MODEL` | `llama3.2:1b` | Model to pull and use |
| `TELEGRAM_BOT_TOKEN` | _(none)_ | Enables the Telegram bot service |
| `TELEGRAM_ALLOWED_CHAT_ID` | _(none)_ | Locks the Telegram bot to one chat |

Useful commands afterward:

```bash
sudo systemctl status jarvis-web        # is it running?
sudo systemctl restart jarvis-web       # restart it
journalctl -u jarvis-web -f             # follow its logs
```

(Swap `jarvis-web` for `jarvis-telegram` for the bot service.)

### Manual setup

Prefer to do it by hand, or running on a non-Debian Linux box? Follow the regular
[Setup](#setup) and [Telegram bot](#telegram-bot) steps above, then use the systemd unit files in
[`deploy/`](deploy/) as a starting point — copy them to `/etc/systemd/system/`, edit the `User`,
`WorkingDirectory`, and `ExecStart` paths for your setup, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now jarvis-web
sudo systemctl enable --now jarvis-telegram   # if you're using the bot too
```

## Persona

JARVIS is given a short system prompt so it responds in character (concise, dry-witted, addresses you
respectfully). Turn this off if you'd rather have a plain assistant:

```bash
JARVIS_PERSONA=false npm start
```

## Project layout

```
bin/
  jarvis.js       The `jarvis` CLI: terminal chat + status/model/memory commands
server/
  index.js        Express app + routes (web/PWA interface)
  telegram-bot.js Telegram long-polling bot (optional interface)
  ollama.js       Streaming client for the local Ollama API
  storage.js      Conversation history, stored as JSON files in data/
  memory.js       Long-term memory shared across all interfaces
  commands.js     Shared /remember, /memory, /forget slash-command handling
  persona.js      Shared JARVIS system prompt
  config.js       Port, model, persona, Ollama host, Telegram — all overridable via env vars / .env
public/
  index.html    App shell
  styles.css    HUD-styled, touch-first UI
  app.js        Conversation list, streaming chat, PWA registration
  manifest.json PWA manifest (installable on phone/PC)
  service-worker.js  Caches the app shell so it loads instantly / offline
data/
  conversations/*.json   Your chat history (gitignored — stays on your PC)
  memory.json             Long-term memory facts (gitignored — stays on your PC)
deploy/
  jarvis-web.service       systemd unit template for the web interface
  jarvis-telegram.service  systemd unit template for the Telegram bot
install.sh          One-line installer for Raspberry Pi / Debian / Ubuntu
.env.example         Template for .env (used by the systemd services and the CLI)
```

## Troubleshooting

- **LINK shows OFFLINE / UNREACHABLE** — make sure Ollama is running (`ollama serve` if it's not
  already running as a background service) and that you've pulled the model named in `JARVIS_MODEL`
  (default `llama3.2`).
- **Phone can't reach the PC** — confirm both devices are on the same wifi network (Option A), or set
  up Tailscale (Option B). Check your PC's firewall isn't blocking port 3000.
- **Responses are slow** — local LLMs are only as fast as your PC's CPU/GPU. Try a smaller model
  (e.g. `llama3.2:1b`) if it's too slow.
