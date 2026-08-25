const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  ollamaHost: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  defaultModel: process.env.JARVIS_MODEL || 'llama3.2',
  persona: process.env.JARVIS_PERSONA !== 'false',
  dataDir: path.join(__dirname, '..', 'data'),
};
