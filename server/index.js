const express = require('express');
const path = require('path');
const os = require('os');
const config = require('./config');
const ollama = require('./ollama');
const storage = require('./storage');
const memory = require('./memory');
const { handleCommand } = require('./commands');
const SYSTEM_PROMPT = require('./persona');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', async (req, res) => {
  const health = await ollama.checkHealth();
  res.json({ ...health, model: config.defaultModel });
});

function localNetworkAddresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) addresses.push(net.address);
    }
  }
  return addresses;
}

app.get('/api/info', (req, res) => {
  res.json({
    model: config.defaultModel,
    port: config.port,
    persona: config.persona,
    hostname: os.hostname(),
    lanAddresses: localNetworkAddresses(),
  });
});

app.get('/api/conversations', (req, res) => {
  res.json(storage.listConversations());
});

app.post('/api/conversations', (req, res) => {
  const conv = storage.createConversation();
  res.json(conv);
});

app.get('/api/conversations/:id', (req, res) => {
  const conv = storage.getConversation(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  res.json(conv);
});

app.delete('/api/conversations/:id', (req, res) => {
  storage.deleteConversation(req.params.id);
  res.status(204).end();
});

app.post('/api/conversations/:id/messages', async (req, res) => {
  const conv = storage.getConversation(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });

  const userText = (req.body.content || '').trim();
  if (!userText) return res.status(400).json({ error: 'Empty message' });

  conv.messages.push({ role: 'user', content: userText, at: new Date().toISOString() });
  if (conv.title === 'New conversation') {
    conv.title = userText.slice(0, 48);
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('X-Accel-Buffering', 'no');

  const cmd = handleCommand(userText);
  if (cmd.handled) {
    res.write(cmd.reply);
    conv.messages.push({ role: 'assistant', content: cmd.reply, at: new Date().toISOString() });
    conv.updatedAt = new Date().toISOString();
    storage.saveConversation(conv);
    return res.end();
  }

  const systemPrompt = SYSTEM_PROMPT + memory.asSystemPromptAddendum();
  const modelMessages = [
    ...(config.persona ? [{ role: 'system', content: systemPrompt }] : []),
    ...conv.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  let full = '';
  try {
    for await (const chunk of ollama.streamChat(config.defaultModel, modelMessages)) {
      full += chunk;
      res.write(chunk);
    }
  } catch (err) {
    const msg = `[JARVIS is offline: ${err.message}. Confirm Ollama is running and that the "${config.defaultModel}" model has been pulled.]`;
    full += msg;
    res.write(msg);
  }

  conv.messages.push({ role: 'assistant', content: full, at: new Date().toISOString() });
  conv.updatedAt = new Date().toISOString();
  storage.saveConversation(conv);

  res.end();
});

app.listen(config.port, '0.0.0.0', () => {
  const addrs = localNetworkAddresses();
  console.log(`J.A.R.V.I.S. is online at http://localhost:${config.port}`);
  if (addrs.length) {
    console.log('Reachable from your phone (same network) at:');
    addrs.forEach((a) => console.log(`  http://${a}:${config.port}`));
  }
});
