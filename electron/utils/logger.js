// electron/utils/logger.js
const LEVEL_COLORS = {
  log: '\x1b[32m', // green
  info: '\x1b[36m', // cyan
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m' // red
};
const ANSI_RESET = '\x1b[0m';

function colorize(text, color) {
  if (!color) return text;
  return `${color}${text}${ANSI_RESET}`;
}

function formatExtra(extra, color) {
  if (!extra || !Object.keys(extra).length) return '';
  return ` ${colorize(JSON.stringify(extra), color)}`;
}

function pad(text, length, direction = 'end') {
  const value = String(text);
  if (direction === 'end') {
    return value.padEnd(length, ' ');
  }
  return value.padStart(length, ' ');
}

function getTimestampParts() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const minute = pad(now.getMinutes());
  const hour = pad(now.getHours());
  const day = pad(now.getDate());
  const month = pad(now.getMonth() + 1);
  const monthName = now
    .toLocaleString('pt-BR', { month: 'long' })
    .replace(/^\w/, (chr) => chr.toUpperCase());
  const formatted = `${day}/${month}/${now.getFullYear()} ${hour}:${minute}:${pad(
    now.getSeconds()
  )}`;
  return {
    formatted,
    minute,
    hour,
    day,
    month,
    monthName
  };
}

function baseLog(level, ctx, message, extra, options = {}) {
  const color = LEVEL_COLORS[level] || '';
  const parts = getTimestampParts();
  const tsPart = colorize(`[${parts.formatted}]`, '\x1b[37m');
  const levelPart = colorize(`[${level.toUpperCase()}]`, color);
  const ctxPart = colorize(`[${ctx}]`, '\x1b[90m');
  const detailPart = colorize(
    `[tempo:${parts.hour}:${parts.minute} ${parts.day}/${parts.month}]`,
    '\x1b[90m'
  );
  const messageColor = options.messageColor || color;
  const body = options.skipMessageColor
     message
    : colorize(message, messageColor);
  const payload = formatExtra(
    extra,
    options.payloadColor || '\x1b[90m'
  );
  console[level](
    `${tsPart} ${levelPart} ${ctxPart} ${detailPart} ${body}${payload}`
  );
}

function logInfo(ctx, message, extra = {}, options = {}) {
  baseLog('log', ctx, message, extra, options);
}

function logWarn(ctx, message, extra = {}, options = {}) {
  baseLog('warn', ctx, message, extra, options);
}

function logError(ctx, message, err, extra = {}, options = {}) {
  const errData = {
    name: err && err.name,
    message: err && err.message,
    stack: err && err.stack
  };
  baseLog('error', ctx, message, { ...extra, error: errData });
}

module.exports = {
  logInfo,
  logWarn,
  logError,
  LEVEL_COLORS,
  getTimestampParts, // Export this if it's used elsewhere
  colorize, // Export if used elsewhere
  pad, // Export if used elsewhere
};
