const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env');

function loadEnvFile() {
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

// Update (or add) a single key in .env, creating the file if needed.
// Used by `jarvis model <name>` so changes persist across restarts of any interface.
function setEnvValue(key, value) {
  const lines = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8').split('\n') : [];
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) next.push(`${key}=${value}`);
  fs.writeFileSync(envFile, next.join('\n'));
  process.env[key] = value;
}

loadEnvFile();

module.exports = {
  port: process.env.PORT || 3000,
  ollamaHost: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  defaultModel: process.env.JARVIS_MODEL || 'llama3.2',
  persona: process.env.JARVIS_PERSONA !== 'false',
  dataDir: path.join(__dirname, '..', 'data'),
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramAllowedChatId: process.env.TELEGRAM_ALLOWED_CHAT_ID || '',
  setEnvValue,
};
