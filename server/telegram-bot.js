const config = require('./config');
const ollama = require('./ollama');
const storage = require('./storage');
const SYSTEM_PROMPT = require('./persona');

const TELEGRAM_MESSAGE_LIMIT = 4000;

function apiUrl(method) {
  return `https://api.telegram.org/bot${config.telegramToken}/${method}`;
}

function splitForTelegram(text) {
  const parts = [];
  let rest = text;
  while (rest.length > TELEGRAM_MESSAGE_LIMIT) {
    let cut = rest.lastIndexOf('\n', TELEGRAM_MESSAGE_LIMIT);
    if (cut < TELEGRAM_MESSAGE_LIMIT * 0.5) cut = TELEGRAM_MESSAGE_LIMIT;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  parts.push(rest);
  return parts;
}

async function sendMessage(chatId, text) {
  for (const part of splitForTelegram(text)) {
    if (!part.trim()) continue;
    await fetch(apiUrl('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: part }),
    });
  }
}

async function sendTyping(chatId) {
  await fetch(apiUrl('sendChatAction'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  }).catch(() => {});
}

function isAllowed(chatId) {
  if (!config.telegramAllowedChatId) return true;
  return String(chatId) === String(config.telegramAllowedChatId);
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  if (!text) return;

  if (!isAllowed(chatId)) {
    await sendMessage(
      chatId,
      `This JARVIS instance is private. Your chat ID is ${chatId} - set TELEGRAM_ALLOWED_CHAT_ID to this value if this is you, then restart the bot.`
    );
    return;
  }

  if (text === '/start') {
    await sendMessage(chatId, `J.A.R.V.I.S. online, sir. Your chat ID is ${chatId}. Ask away.`);
    return;
  }
  if (text === '/reset') {
    storage.deleteConversation(`telegram-${chatId}`);
    await sendMessage(chatId, 'Memory cleared. Starting fresh.');
    return;
  }

  const conv = storage.getOrCreateConversation(`telegram-${chatId}`, `Telegram chat ${chatId}`);
  conv.messages.push({ role: 'user', content: text, at: new Date().toISOString() });

  const modelMessages = [
    ...(config.persona ? [{ role: 'system', content: SYSTEM_PROMPT }] : []),
    ...conv.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  await sendTyping(chatId);

  let full = '';
  try {
    for await (const chunk of ollama.streamChat(config.defaultModel, modelMessages)) {
      full += chunk;
    }
  } catch (err) {
    full = `JARVIS is offline: ${err.message}. Confirm Ollama is running on this PC and that the "${config.defaultModel}" model has been pulled.`;
  }

  conv.messages.push({ role: 'assistant', content: full, at: new Date().toISOString() });
  conv.updatedAt = new Date().toISOString();
  storage.saveConversation(conv);

  await sendMessage(chatId, full || '...');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollLoop() {
  let offset = 0;
  console.log('J.A.R.V.I.S. Telegram bot is polling for messages...');
  while (true) {
    let data;
    try {
      const res = await fetch(`${apiUrl('getUpdates')}?timeout=30&offset=${offset}`);
      data = await res.json();
      if (!data.ok) {
        console.error('Telegram getUpdates error:', data.description);
        await sleep(5000);
        continue;
      }
    } catch (err) {
      console.error('Telegram polling error:', err.message);
      await sleep(5000);
      continue;
    }

    for (const update of data.result) {
      offset = update.update_id + 1;
      if (update.message) {
        handleMessage(update.message).catch((err) => console.error('Error handling message:', err));
      }
    }
  }
}

function start() {
  if (!config.telegramToken) {
    console.error(
      'TELEGRAM_BOT_TOKEN is not set. Create a bot with @BotFather on Telegram, then set TELEGRAM_BOT_TOKEN to the token it gives you.'
    );
    process.exit(1);
  }
  pollLoop();
}

module.exports = { start, handleMessage, isAllowed, splitForTelegram };

if (require.main === module) {
  start();
}
