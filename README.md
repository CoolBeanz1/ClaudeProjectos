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
- 🖐️ **Touch-first UI** — off-canvas navigation drawer, large tap targets, fixed bottom composer,
  safe-area aware for notched phones.
- 💾 **Local history** — conversations are stored as plain JSON files on your PC, never sent anywhere.

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

- **Node.js 18+** on the PC that will run JARVIS.
- **[Ollama](https://ollama.com/download)** installed and running on that same PC.
- At least one local model pulled, e.g.:
  ```bash
  ollama pull llama3.2
  ```
  (Smaller/faster: `llama3.2:1b`. Better quality if your PC can handle it: `llama3.1:8b`, `mistral`, `qwen2.5:7b`, etc.)

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

Send `/reset` in the chat at any time to clear that conversation's memory. The bot polls Telegram for
new messages (no inbound port or public URL needed) and can run alongside `npm start` — they share
the same Ollama connection but keep separate conversation histories.

> Leave this running as a background process (e.g. via `pm2`, a systemd service, or just a terminal
> you don't close) if you want it reachable at all times, since it only responds while the PC is
> awake and the process is running.

## Persona

JARVIS is given a short system prompt so it responds in character (concise, dry-witted, addresses you
respectfully). Turn this off if you'd rather have a plain assistant:

```bash
JARVIS_PERSONA=false npm start
```

## Project layout

```
server/
  index.js        Express app + routes (web/PWA interface)
  telegram-bot.js Telegram long-polling bot (optional interface)
  ollama.js       Streaming client for the local Ollama API
  storage.js      Conversation history, stored as JSON files in data/
  persona.js      Shared JARVIS system prompt
  config.js       Port, model, persona, Ollama host, Telegram — all overridable via env vars
public/
  index.html    App shell
  styles.css    HUD-styled, touch-first UI
  app.js        Conversation list, streaming chat, PWA registration
  manifest.json PWA manifest (installable on phone/PC)
  service-worker.js  Caches the app shell so it loads instantly / offline
data/
  conversations/*.json   Your chat history (gitignored — stays on your PC)
```

## Troubleshooting

- **LINK shows OFFLINE / UNREACHABLE** — make sure Ollama is running (`ollama serve` if it's not
  already running as a background service) and that you've pulled the model named in `JARVIS_MODEL`
  (default `llama3.2`).
- **Phone can't reach the PC** — confirm both devices are on the same wifi network (Option A), or set
  up Tailscale (Option B). Check your PC's firewall isn't blocking port 3000.
- **Responses are slow** — local LLMs are only as fast as your PC's CPU/GPU. Try a smaller model
  (e.g. `llama3.2:1b`) if it's too slow.
