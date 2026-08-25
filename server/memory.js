const fs = require('fs');
const path = require('path');
const { dataDir } = require('./config');

const memoryFile = path.join(dataDir, 'memory.json');

function load() {
  if (!fs.existsSync(memoryFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
  } catch {
    return [];
  }
}

function save(facts) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(memoryFile, JSON.stringify(facts, null, 2));
}

function remember(fact) {
  const facts = load();
  facts.push({ fact: fact.trim(), addedAt: new Date().toISOString() });
  save(facts);
  return facts;
}

function forget(index) {
  const facts = load();
  if (index < 0 || index >= facts.length) return null;
  const [removed] = facts.splice(index, 1);
  save(facts);
  return removed;
}

function clear() {
  save([]);
}

function list() {
  return load();
}

function asSystemPromptAddendum() {
  const facts = load();
  if (!facts.length) return '';
  return `\n\nThings you know about your user from past conversations (treat these as true unless the user says otherwise):\n${facts.map((f) => `- ${f.fact}`).join('\n')}`;
}

module.exports = { remember, forget, clear, list, asSystemPromptAddendum };
