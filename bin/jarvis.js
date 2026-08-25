#!/usr/bin/env node
const readline = require('readline');
const config = require('../server/config');
const ollama = require('../server/ollama');
const storage = require('../server/storage');
const memory = require('../server/memory');
const { handleCommand } = require('../server/commands');
const SYSTEM_PROMPT = require('../server/persona');

const CLI_CONVERSATION_ID = 'cli-local';

async function chatRepl() {
  console.log('J.A.R.V.I.S. — type a message and press enter.');
  console.log('/reset clears this chat, /remember <fact>, /memory, /forget <n|all>. Ctrl+C to quit.\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'you> ' });
  rl.prompt();

  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text) {
      rl.prompt();
      return;
    }

    if (text === '/reset') {
      storage.deleteConversation(CLI_CONVERSATION_ID);
      console.log('Conversation cleared.\n');
      rl.prompt();
      return;
    }

    const cmd = handleCommand(text);
    if (cmd.handled) {
      console.log(cmd.reply + '\n');
      rl.prompt();
      return;
    }

    const conv = storage.getOrCreateConversation(CLI_CONVERSATION_ID, 'CLI session');
    conv.messages.push({ role: 'user', content: text, at: new Date().toISOString() });

    const systemPrompt = SYSTEM_PROMPT + memory.asSystemPromptAddendum();
    const modelMessages = [
      ...(config.persona ? [{ role: 'system', content: systemPrompt }] : []),
      ...conv.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    process.stdout.write('jarvis> ');
    let full = '';
    try {
      for await (const chunk of ollama.streamChat(config.defaultModel, modelMessages)) {
        full += chunk;
        process.stdout.write(chunk);
      }
    } catch (err) {
      full = `[JARVIS is offline: ${err.message}. Confirm Ollama is running and that the "${config.defaultModel}" model has been pulled.]`;
      process.stdout.write(full);
    }
    process.stdout.write('\n\n');

    conv.messages.push({ role: 'assistant', content: full, at: new Date().toISOString() });
    conv.updatedAt = new Date().toISOString();
    storage.saveConversation(conv);

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nGoodbye, sir.');
    process.exit(0);
  });
}

async function printStatus() {
  const health = await ollama.checkHealth();
  console.log(`Model:                   ${config.defaultModel}`);
  console.log(`Ollama:                  ${health.ok ? 'online' : `offline (${health.error})`}`);
  console.log(`Persona:                 ${config.persona ? 'on' : 'off'}`);
  console.log(`Telegram bot configured: ${config.telegramToken ? 'yes' : 'no'}`);
  console.log(`Long-term memory facts:  ${memory.list().length}`);
}

async function handleModelCommand(newModel) {
  if (!newModel) {
    console.log(`Current model: ${config.defaultModel}`);
    const health = await ollama.checkHealth();
    if (health.ok) {
      console.log('Locally available models:');
      health.models.forEach((m) => console.log(`  ${m}`));
    } else {
      console.log(`Could not reach Ollama to list models: ${health.error}`);
    }
    return;
  }
  config.setEnvValue('JARVIS_MODEL', newModel);
  console.log(`Model set to "${newModel}".`);
  console.log('This takes effect next time an interface starts (new "jarvis chat", or restart jarvis-web/jarvis-telegram).');
}

function printMemory() {
  const facts = memory.list();
  if (!facts.length) {
    console.log('No memory stored yet. Try: jarvis remember "<fact>"');
    return;
  }
  facts.forEach((f, i) => console.log(`${i + 1}. ${f.fact}  (${f.addedAt})`));
}

function forgetMemory(arg) {
  if (arg === 'all') {
    memory.clear();
    console.log('Memory cleared.');
    return;
  }
  const index = parseInt(arg, 10);
  if (!index || index < 1) {
    console.log('Usage: jarvis forget <number from "jarvis memory"> | jarvis forget all');
    return;
  }
  const removed = memory.forget(index - 1);
  console.log(removed ? `Forgotten: "${removed.fact}"` : 'No memory with that number.');
}

function printHelp() {
  console.log(`J.A.R.V.I.S. CLI

Usage: jarvis [command]

  (none) / chat       Start an interactive chat in this terminal
  web                 Run the web/PWA server (same as npm start)
  telegram            Run the Telegram bot (same as npm run telegram)
  model [name]        Show current model + locally available models, or set a new one
  status              Show Ollama connection, model, persona, memory status
  memory              List everything JARVIS remembers about you long-term
  remember <fact>     Save something to long-term memory
  forget <n|all>      Remove one memory entry (number from "jarvis memory"), or all
  reset               Clear the CLI chat's conversation history
  help                Show this message

Inside any chat (CLI, web, or Telegram) the same memory commands also work as
slash commands: /remember <fact>, /memory, /forget <n|all>, /reset.`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case undefined:
    case 'chat':
      return chatRepl();
    case 'web':
      require('../server/index.js');
      return;
    case 'telegram':
      require('../server/telegram-bot.js').start();
      return;
    case 'status':
      return printStatus();
    case 'model':
      return handleModelCommand(rest[0]);
    case 'memory':
      return printMemory();
    case 'remember': {
      const fact = rest.join(' ').trim();
      if (!fact) {
        console.log('Usage: jarvis remember <fact>');
        return;
      }
      memory.remember(fact);
      console.log(`Noted: "${fact}"`);
      return;
    }
    case 'forget':
      return forgetMemory(rest[0]);
    case 'reset':
      storage.deleteConversation(CLI_CONVERSATION_ID);
      console.log('CLI conversation history cleared.');
      return;
    case 'help':
    case '--help':
    case '-h':
      return printHelp();
    default:
      console.log(`Unknown command: ${command}\n`);
      return printHelp();
  }
}

main();
