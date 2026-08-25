const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dataDir } = require('./config');

const convDir = path.join(dataDir, 'conversations');

function ensureDirs() {
  fs.mkdirSync(convDir, { recursive: true });
}

function listConversations() {
  ensureDirs();
  const files = fs.readdirSync(convDir).filter((f) => f.endsWith('.json'));
  const items = files.map((f) => {
    const data = JSON.parse(fs.readFileSync(path.join(convDir, f), 'utf8'));
    return {
      id: data.id,
      title: data.title,
      updatedAt: data.updatedAt,
      messageCount: data.messages.length,
    };
  });
  items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return items;
}

function getConversation(id) {
  ensureDirs();
  const file = path.join(convDir, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveConversation(conv) {
  ensureDirs();
  fs.writeFileSync(path.join(convDir, `${conv.id}.json`), JSON.stringify(conv, null, 2));
}

function deleteConversation(id) {
  const file = path.join(convDir, `${id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function createConversation() {
  const conv = {
    id: crypto.randomUUID(),
    title: 'New conversation',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
  saveConversation(conv);
  return conv;
}

module.exports = {
  listConversations,
  getConversation,
  saveConversation,
  deleteConversation,
  createConversation,
};
