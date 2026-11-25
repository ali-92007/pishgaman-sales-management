const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(process.cwd(), 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, 'app.log');

function write(level, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  if (level === 'ERROR') {
    console.error(line);
  } else {
    console.log(line);
  }
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {
    /* ignore file write issues */
  }
}

module.exports = {
  info: (msg) => write('INFO', msg),
  warn: (msg) => write('WARN', msg),
  error: (msg) => write('ERROR', msg),
  debug: (msg) => {
    if (process.env.DEBUG === '1') write('DEBUG', msg);
  },
};
