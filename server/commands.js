const memory = require('./memory');

// Handles memory-related slash commands shared by the web, Telegram, and CLI interfaces.
// Each surface still handles its own /reset (it needs to touch that surface's own
// conversation storage before this runs), and /start is Telegram-only.
function handleCommand(text) {
  const trimmed = text.trim();

  if (trimmed.startsWith('/remember ')) {
    const fact = trimmed.slice('/remember '.length).trim();
    if (!fact) return { handled: true, reply: 'Usage: /remember <something to remember>' };
    memory.remember(fact);
    return { handled: true, reply: `Noted. I'll remember: "${fact}"` };
  }

  if (trimmed === '/memory') {
    const facts = memory.list();
    if (!facts.length) {
      return { handled: true, reply: 'Nothing in long-term memory yet. Try: /remember <fact>' };
    }
    const listing = facts.map((f, i) => `${i + 1}. ${f.fact}`).join('\n');
    return { handled: true, reply: `Long-term memory:\n${listing}` };
  }

  if (trimmed === '/forget all') {
    memory.clear();
    return { handled: true, reply: 'Long-term memory cleared.' };
  }

  if (trimmed.startsWith('/forget')) {
    const arg = trimmed.slice('/forget'.length).trim();
    const index = parseInt(arg, 10);
    if (!index || index < 1) {
      return { handled: true, reply: 'Usage: /forget <number from /memory>, or /forget all' };
    }
    const removed = memory.forget(index - 1);
    return {
      handled: true,
      reply: removed ? `Forgotten: "${removed.fact}"` : 'No memory with that number.',
    };
  }

  return { handled: false };
}

module.exports = { handleCommand };
