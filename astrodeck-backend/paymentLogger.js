const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function logLine(prefix, obj) {
  try {
    const dir = path.join(__dirname, 'logs');
    ensureDir(dir);

    const ts = new Date().toISOString();
    const line = `[${ts}] ${prefix} ${JSON.stringify(obj)}\n`;
    fs.appendFileSync(path.join(dir, 'payments.log'), line, 'utf8');
  } catch {
    // ignore
  }
}

module.exports = { logLine };
