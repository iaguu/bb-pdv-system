
// electron/apiServer.js
// Servidor HTTP/REST para expor o DataEngine via HTTP (site, app, integrações)

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { EventEmitter } = require('events');
require('dotenv').config();


// ==== LOGGING & UTILS =======================================================

function nowISO() {
  return new Date().toISOString();
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

let reqCounter = 0;
function nextRequestId() {
  const ts = Date.now().toString(36);
  const counter = (reqCounter = (reqCounter + 1) % 100000);
  return `req-${ts}-${counter.toString(16)}`;
}

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
    ? message
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

function parseBigIntValue(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.floor(value));
  }
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const num = Number(normalized);
    if (Number.isFinite(num)) {
      return BigInt(Math.floor(num));
    }
  }
  return null;
}

function normalizeNeighborhoodKey(value) {
  if (!value) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function findBlockedNeighborhood(neighborhood, blockedList) {
  if (!neighborhood || !Array.isArray(blockedList)) return null;
  const key = normalizeNeighborhoodKey(neighborhood);
  if (!key) return null;
  return (
    blockedList.find(
      (item) => normalizeNeighborhoodKey(item) === key
    ) || null
  );
}

function resolveOrderNeighborhood(order) {
  if (!order || typeof order !== 'object') return '';
  return (
    order.customerAddress?.neighborhood ||
    order.customerAddress?.bairro ||
    order.customer?.address?.neighborhood ||
    order.customer?.address?.bairro ||
    order.delivery?.neighborhood ||
    order.delivery?.bairro ||
    order.deliveryNeighborhood ||
    order.address?.neighborhood ||
    order.address?.bairro ||
    ''
  );
}

function isDeliveryOrder(order) {
  if (!order || typeof order !== 'object') return false;
  if (order.retirada === true) return false;

  const typeRaw = (
    order.orderType ||
    order.type ||
    order.delivery?.mode ||
    order.source ||
    ''
  )
    .toString()
    .toLowerCase()
    .trim();

  if (['pickup', 'retirada', 'counter', 'balcao', 'balcão', 'local'].includes(typeRaw)) {
    return false;
  }

  if (typeRaw === 'delivery') return true;

  return Boolean(order.delivery || order.deliveryFee != null || order.delivery?.fee != null);
}

function normalizeSettingsData(raw) {
  if (!raw) return null;
  if (Array.isArray(raw.items) && raw.items.length > 0) return raw.items[0];
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  if (typeof raw === 'object') return raw;
  return null;
}

function parseNumberValue(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value).replace(',', '.');
  const num = Number(normalized);
  return Number.isNaN(num) ? 0 : num;
}

function parseTimeToMinutes(value) {
  if (!value || typeof value !== 'string') return null;
  const [h, m] = value.split(':').map((part) => Number(part));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function buildWeeklySchedule(
  openTime = '11:00',
  closeTime = '23:00',
  closedWeekdays = []
) {
  const closed = Array.isArray(closedWeekdays) ? closedWeekdays : [];
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    enabled: !closed.includes(day),
    openTime,
    closeTime
  }));
}

function isWithinTimeRange(nowMinutes, startMinutes, endMinutes) {
  if (startMinutes === null || endMinutes === null) return true;
  if (startMinutes === endMinutes) return true;
  if (endMinutes > startMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes <= endMinutes;
}

function getBusinessHoursStatus(businessHours, date = new Date()) {
  if (!businessHours?.enabled) return { isOpen: true, reason: '' };

  const weekday = date.getDay();
  const closed = Array.isArray(businessHours.closedWeekdays)
    ? businessHours.closedWeekdays
    : [];
  const schedule = Array.isArray(businessHours.weeklySchedule)
    ? businessHours.weeklySchedule
    : [];
  const scheduleEntry = schedule.find(
    (entry) => Number(entry.day) === weekday
  );

  if (scheduleEntry && scheduleEntry.enabled === false) {
    return { isOpen: false, reason: 'Dia fechado.' };
  }
  if (!scheduleEntry && closed.includes(weekday)) {
    return { isOpen: false, reason: 'Dia fechado.' };
  }

  const openTime =
    scheduleEntry?.openTime || businessHours.openTime || '11:00';
  const closeTime =
    scheduleEntry?.closeTime || businessHours.closeTime || '23:00';

  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  const openMinutes = parseTimeToMinutes(openTime);
  const closeMinutes = parseTimeToMinutes(closeTime);
  const isOpen = isWithinTimeRange(nowMinutes, openMinutes, closeMinutes);
  return {
    isOpen,
    reason: isOpen ? '' : 'Fora do horario de funcionamento.'
  };
}

function resolveOrderSubtotal(order) {
  if (!order || typeof order !== 'object') return 0;
  if (typeof order.subtotal === 'number') return order.subtotal;
  if (typeof order?.totals?.subtotal === 'number') return order.totals.subtotal;

  const items = Array.isArray(order.items) ? order.items : [];
  return items.reduce((acc, item) => {
    const lineTotalValue =
      item?.total ?? item?.lineTotal ?? item?.totalPrice ?? null;
    if (lineTotalValue !== null && lineTotalValue !== undefined) {
      return acc + parseNumberValue(lineTotalValue);
    }

    const qty = parseNumberValue(item?.quantity ?? item?.qty ?? 1);
    const unit = parseNumberValue(item?.unitPrice ?? item?.price ?? 0);
    return acc + unit * (qty || 0);
  }, 0);
}

function resolveOrderDistanceKm(order) {
  if (!order || typeof order !== 'object') return 0;

  const candidates = [
    order.deliveryDistanceKm,
    order.deliveryDistance,
    order.distanceKm,
    order.distance,
    order.delivery?.distanceKm,
    order.delivery?.distance,
    order.delivery?.metrics?.distanceKm
  ];

  for (const value of candidates) {
    const km = parseNumberValue(value);
    if (km > 0) return km;
  }

  return 0;
}

async function getOrderValidationSettings() {
  try {
    const settings = await db.getCollection('settings');
    const item = normalizeSettingsData(settings) || {};
    const delivery = item.delivery || {};
    const businessHours = item.businessHours || {};
    const blockedNeighborhoods = Array.isArray(delivery.blockedNeighborhoods)
      ? delivery.blockedNeighborhoods
          .map((b) => (b || '').toString().trim())
          .filter(Boolean)
      : [];

    const openTime = businessHours.openTime || '11:00';
    const closeTime = businessHours.closeTime || '23:00';
    const closedWeekdays = Array.isArray(businessHours.closedWeekdays)
      ? businessHours.closedWeekdays
      : [];
    const baseSchedule = buildWeeklySchedule(
      openTime,
      closeTime,
      closedWeekdays
    );
    const rawSchedule = Array.isArray(businessHours.weeklySchedule)
      ? businessHours.weeklySchedule
      : null;
    const weeklySchedule = rawSchedule
      ? baseSchedule.map((entry) => {
          const match = rawSchedule.find(
            (item) => Number(item.day) === entry.day
          );
          if (!match) return entry;
          return {
            ...entry,
            enabled: match.enabled !== false,
            openTime: match.openTime || entry.openTime,
            closeTime: match.closeTime || entry.closeTime
          };
        })
      : baseSchedule;
    const normalizedClosedWeekdays = weeklySchedule
      .filter((entry) => entry.enabled === false)
      .map((entry) => entry.day);

    return {
      blockedNeighborhoods,
      minOrderValue: parseNumberValue(delivery.minOrderValue),
      maxDistanceKm: parseNumberValue(delivery.maxDistanceKm),
      businessHours: {
        enabled: !!businessHours.enabled,
        openTime,
        closeTime,
        closedWeekdays: normalizedClosedWeekdays,
        weeklySchedule
      }
    };
  } catch (err) {
    logError('apiServer', 'Falha ao ler settings de entrega', err);
    return {
      blockedNeighborhoods: [],
      minOrderValue: 0,
      maxDistanceKm: 0,
      businessHours: {
        enabled: false,
        openTime: '11:00',
        closeTime: '23:00',
        closedWeekdays: []
      }
    };
  }
}

function shouldValidateDeliveryChanges(changes) {
  if (!changes || typeof changes !== 'object') return false;

  const directKeys = [
    'orderType',
    'type',
    'deliveryDistanceKm',
    'deliveryDistance',
    'deliveryFee',
    'deliveryNeighborhood',
    'customerAddress',
    'address',
    'items',
    'subtotal',
    'totals',
    'total',
    'discount'
  ];

  if (directKeys.some((key) => Object.prototype.hasOwnProperty.call(changes, key))) {
    return true;
  }

  if (changes.delivery && typeof changes.delivery === 'object') {
    const deliveryKeys = ['address', 'distanceKm', 'distance', 'fee', 'neighborhood', 'mode'];
    return deliveryKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(changes.delivery, key)
    );
  }

  return false;
}

function getStatusColor(statusCode) {
  if (!statusCode) return LEVEL_COLORS.info;
  if (statusCode >= 500) return LEVEL_COLORS.error;
  if (statusCode >= 400) return LEVEL_COLORS.warn;
  if (statusCode >= 300) return LEVEL_COLORS.info;
  return LEVEL_COLORS.log;
}

function getDurationColor(durationMs) {
  if (durationMs < 10) return LEVEL_COLORS.log;
  if (durationMs < 50) return LEVEL_COLORS.warn;
  return LEVEL_COLORS.error;
}

/**
 * Log estruturado de erro de API, com dados da requisição
 */
function logApiError(req, label, err, extra = {}) {
  const safeBody =
    req && req.body && typeof req.body === 'object'
      ? JSON.stringify(req.body).slice(0, 1000)
      : undefined;

  const ctx = label || 'api';

  logError(ctx, 'Erro em handler de API', err, {
    requestId: req && req.id,
    method: req && req.method,
    url: (req && (req.originalUrl || req.url)),
    ip: (req && (req.ip || (req.connection && req.connection.remoteAddress))),
    query: req && req.query,
    params: req && req.params,
    body: safeBody,
    ...extra
  });
}

// Agora que DATA_DIR est  definido (se existir), podemos carregar o db.js
const db = require('./db');
const orderEvents = new EventEmitter();

const app = express();
const EMBEDDED_API_PORT =
  Number(process.env.EMBEDDED_API_PORT || process.env.PORT || 3030) || 3030;
const EMBEDDED_API_PORT_MAX =
  Math.max(
    EMBEDDED_API_PORT,
    Number(process.env.EMBEDDED_API_PORT_MAX || EMBEDDED_API_PORT + 10) ||
      EMBEDDED_API_PORT + 10
  );
const PUBLIC_API_TOKEN = process.env.PUBLIC_API_TOKEN || '';
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 120);
const rateStore = new Map();

let currentApiPort = EMBEDDED_API_PORT;
let serverInstance = null;

function getTrackingBaseUrl() {
  return (
    process.env.ANNETOM_TRACKING_BASE_URL ||
    `https://motoboy.annetom.com/?order=`
  );
}

function normalizeTrackingValue(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function resolveOrderIdentifier(order) {
  if (!order) return null;
  if (order.id) return order.id;
  if (order._id) return order._id;
  if (order.orderId) return order.orderId;
  return null;
}

function resolveTrackingPayload(order) {
  if (!order) return { trackingUrl: null, trackingCode: null };

  const candidates = [
    order.trackingCode,
    order.tracking_code,
    order.delivery?.trackingCode,
    order.delivery?.tracking_code,
    order.id,
    order.orderId,
    order.code,
    order.numeroPedido
  ]
    .map(normalizeTrackingValue)
    .filter(Boolean);
  const trackingCode = candidates.length ? candidates[0] : null;

  const directUrls = [
    order.trackingUrl,
    order.tracking_url,
    order.delivery?.trackingUrl,
    order.delivery?.tracking_url
  ]
    .map(normalizeTrackingValue)
    .filter(Boolean);
  let trackingUrl = directUrls.length ? directUrls[0] : null;
  if (!trackingUrl && trackingCode) {
    const base = getTrackingBaseUrl();
    if (base) {
      trackingUrl = `${base}${encodeURIComponent(trackingCode)}`;
    }
  }

  return { trackingUrl, trackingCode };
}

function buildTrackingUpdates(order) {
  if (!order) return null;
  const { trackingCode, trackingUrl } = resolveTrackingPayload(order);
  if (!trackingCode && !trackingUrl) return null;

  const updates = {};
  if (trackingCode) {
    if (order.trackingCode !== trackingCode) updates.trackingCode = trackingCode;
    if (order.tracking_code !== trackingCode) updates.tracking_code = trackingCode;
  }
  if (trackingUrl) {
    if (order.trackingUrl !== trackingUrl) updates.trackingUrl = trackingUrl;
    if (order.tracking_url !== trackingUrl) updates.tracking_url = trackingUrl;
  }

  const deliveryUpdates = {};
  const currentDelivery = order.delivery || {};
  if (trackingCode) {
    if (currentDelivery.trackingCode !== trackingCode) {
      deliveryUpdates.trackingCode = trackingCode;
    }
    if (currentDelivery.tracking_code !== trackingCode) {
      deliveryUpdates.tracking_code = trackingCode;
    }
  }
  if (trackingUrl) {
    if (currentDelivery.trackingUrl !== trackingUrl) {
      deliveryUpdates.trackingUrl = trackingUrl;
    }
    if (currentDelivery.tracking_url !== trackingUrl) {
      deliveryUpdates.tracking_url = trackingUrl;
    }
  }

  if (Object.keys(deliveryUpdates).length) {
    updates.delivery = {
      ...(currentDelivery || {}),
      ...deliveryUpdates
    };
  }

  return Object.keys(updates).length ? updates : null;
}

async function persistOrderTracking(order) {
  if (!order) return order;
  const orderId = resolveOrderIdentifier(order);
  if (!orderId) return order;
  const updates = buildTrackingUpdates(order);
  if (!updates) return order;
  try {
    return await db.updateItem("orders", orderId, updates);
  } catch (err) {
    logError('apiServer', 'Falha ao persistir tracking do pedido', err, {
      orderId,
      updates
    });
    return order;
  }
}

function tryBindToPort(port) {
  return new Promise((resolve, reject) => {
    let server;

    const cleanup = () => {
      if (!server) return;
      server.removeListener("error", onError);
      server.removeListener("listening", onListening);
    };

    const onError = (err) => {
      cleanup();
      reject(err);
    };

    const onListening = () => {
      cleanup();
      resolve(server);
    };

    try {
      server = app.listen(port);
    } catch (err) {
      cleanup();
      reject(err);
      return;
    }

    server.once("error", onError);
    server.once("listening", onListening);
  });
}

async function startApiServer() {
  const maxPort = Math.max(EMBEDDED_API_PORT, EMBEDDED_API_PORT_MAX);
  let port = EMBEDDED_API_PORT;

  while (port <= maxPort) {
    try {
      serverInstance = await tryBindToPort(port);
      const actualPort = serverInstance.address().port;
      currentApiPort = actualPort;
      console.log(`[apiServer] Listening on port ${actualPort}`);
      console.log("[apiServer] DATA_DIR (db.js):", db.getDataDir());
      console.log("[apiServer] Collections:", db.listCollections());
      return serverInstance;
    } catch (err) {
      if (err && err.code === "EADDRINUSE" && port < maxPort) {
        console.warn(
          `[apiServer] Port ${port} already in use, trying ${port + 1}...`
        );
        port += 1;
        continue;
      }
      logError('apiServer', 'Failed to start API server', err, {
        port,
        maxPort
      });
      throw err;
    }
  }

  throw new Error(
    `Unable to bind API server on ports ${EMBEDDED_API_PORT}-${maxPort}.`
  );
}

// Normaliza qualquer formato possível do products.json
function normalizeProducts(raw) {
  if (raw && Array.isArray(raw.products)) {
    return {
      version: raw.version || 1,
      exportedAt: raw.exportedAt || new Date().toISOString(),
      products: raw.products
    };
  }
  if (raw && Array.isArray(raw.items)) {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      products: raw.items
    };
  }
  if (Array.isArray(raw)) {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      products: raw
    };
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    products: []
  };
}

function normalizeCollectionWrapper(data) {
  if (Array.isArray(data)) {
    return { items: data, meta: { deleted: [] } };
  }
  if (data && Array.isArray(data.items)) {
    return {
      items: data.items,
      meta:
        data.meta && typeof data.meta === 'object'
          ? data.meta
          : { deleted: [] }
    };
  }
  return null;
}

function applyDeltaToCollection(current, payload) {
  const wrapper = normalizeCollectionWrapper(current) || {
    items: [],
    meta: { deleted: [] }
  };
  const incomingItems = Array.isArray(payload.items) ? payload.items : [];
  const deletedItems = Array.isArray(payload.meta?.deleted)
    ? payload.meta.deleted
    : [];

  for (const item of incomingItems) {
    const index = wrapper.items.findIndex(
      (it) => String(it.id) === String(item.id)
    );
    if (index >= 0) {
      const incomingTs = Date.parse(item.updatedAt || item.createdAt || '');
      const currentTs = Date.parse(
        wrapper.items[index].updatedAt || wrapper.items[index].createdAt || ''
      );
      if (Number.isNaN(incomingTs) || Number.isNaN(currentTs) || incomingTs >= currentTs) {
        wrapper.items[index] = { ...wrapper.items[index], ...item };
      }
    } else {
      wrapper.items.push(item);
    }
  }

  for (const entry of deletedItems) {
    const index = wrapper.items.findIndex(
      (it) => String(it.id) === String(entry.id)
    );
    if (index >= 0) {
      const current = wrapper.items[index];
      const currentTs = Date.parse(
        current.updatedAt || current.createdAt || ''
      );
      const deletedTs = Date.parse(entry.deletedAt || '');
      if (Number.isNaN(deletedTs) || Number.isNaN(currentTs) || deletedTs >= currentTs) {
        wrapper.items.splice(index, 1);
      }
    }
  }

  if (!Array.isArray(wrapper.meta.deleted)) {
    wrapper.meta.deleted = [];
  }
  for (const entry of deletedItems) {
    const existing = wrapper.meta.deleted.find(
      (it) => String(it.id) === String(entry.id)
    );
    if (existing) {
      existing.deletedAt = entry.deletedAt || existing.deletedAt;
    } else {
      wrapper.meta.deleted.push(entry);
    }
  }

  return wrapper;
}

// ============================================================================
// 2. MIDDLEWARES
// ============================================================================

app.set('trust proxy', true);

// Atribui requestId e registra início da requisição
app.use((req, res, next) => {
  req.id = nextRequestId();
  req._startAt = process.hrtime.bigint();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Tokens customizados do morgan
morgan.token('id', (req) => req.id);
morgan.token('iso-date', () => nowISO());

// Logs de acesso HTTP com mais detalhes
app.use(
  morgan(
    ':iso-date [:id] :remote-addr :method :url :status :res[content-length] - :response-time ms',
    {
      stream: {
        write: (msg) => {
          // usa nosso logger para não perder padrão
          logInfo('http', msg.trim());
        }
      }
    }
  )
);

app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.options('*', cors());

// Log de saída com tempo preciso (hrtime)
app.use((req, res, next) => {
  res.on('finish', () => {
    try {
      if (!req._startAt) return;
      const startAt = parseBigIntValue(req._startAt);
      if (startAt === null) return;
      const diffNs = process.hrtime.bigint() - startAt;
      const durationMs = Number(diffNs) / 1e6;
      const statusColor = getStatusColor(res.statusCode);
      const durationColor = getDurationColor(durationMs);
      const lengthValue = res.getHeader('Content-Length') || '-';
      const methodSegment = colorize(pad(req.method, 6), '\x1b[37m');
      const urlSegment = colorize(pad(req.originalUrl || req.url, 40), '\x1b[36m');
      const statusSegment = colorize(pad(res.statusCode, 3, 'start'), statusColor);
      const sizeSegment = colorize(pad(lengthValue, 6, 'start'), '\x1b[90m');
      const durationSegment = colorize(`${durationMs.toFixed(3)} ms`, durationColor);
      const message = `${methodSegment} ${urlSegment} ${statusSegment} ${sizeSegment} ${durationSegment}`;
      logInfo(
        'http-res',
        message,
        {
          requestId: req.id,
          method: req.method,
          url: req.originalUrl || req.url,
          status: res.statusCode,
          durationMs,
          ip: req.ip
        },
        { skipMessageColor: true }
      );
    } catch (e) {
      console.error('[log][http-res] erro ao calcular duração:', e);
    }
  });
  next();
});


function rateLimiter(req, res, next) {
  const now = Date.now();
  const key = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
  const entry = rateStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    res.setHeader('X-RateLimit-Remaining', RATE_LIMIT_MAX - 1);
    return next();
  }

  entry.count += 1;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  res.setHeader('X-RateLimit-Remaining', remaining);

  if (entry.count > RATE_LIMIT_MAX) {
    logWarn('rateLimit', 'Request bloqueada por rate limit', {
      ip: key,
      method: req.method,
      url: req.originalUrl || req.url,
      requestId: req.id,
      count: entry.count,
      windowMs: RATE_LIMIT_WINDOW_MS
    });
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  return next();
}


function requirePublicApiKey(req, res, next) {
  if (!PUBLIC_API_TOKEN) return next();

  if (
    req.method === 'GET' &&
    req.baseUrl === '/motoboy' &&
    req.path.startsWith('/pedido/')
  ) {
    return next();
  }

  const headerToken = req.headers['x-api-key'];
  const queryToken = req.query.api_key;
  const token = headerToken || queryToken;

  if (token !== PUBLIC_API_TOKEN) {
    const masked =
      typeof token === 'string' && token.length > 4
        ? token.slice(0, 2) + '***' + token.slice(-2)
        : token;

    logWarn('auth', 'Chave de API inválida ou ausente', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip,
      providedToken: masked
    });

    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

app.use(rateLimiter);
app.use(['/api', '/motoboy'], requirePublicApiKey);

// ============================================================================
// 3. ENDPOINT OFICIAL DO CARDÁPIO (NOVO)
// ============================================================================
//
// O site SEMPRE vai ler o cardápio daqui: GET /api/menu
// Este endpoint usa o db.js (DATA_DIR) para manter o mesmo banco da API.\r\n//
app.get('/api/menu', async (req, res) => {
  try {
    const raw = await db.getCollection('products');
    const payload = normalizeProducts(raw);
    res.json(payload);
  } catch (err) {
          logApiError(req, 'api:menu', err);
    res.status(500).json({
      error: 'Falha ao carregar cardápio oficial.'
    });
  }
});

// ============================================================================
// 2.1. SYNC (PDV <-> API)
// ============================================================================
function requireSyncAuth(req, res, next) {
  if (!process.env.SYNC_TOKEN) return next();
  if (req.headers['x-sync-token'] !== process.env.SYNC_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

app.get('/sync/collections', requireSyncAuth, async (req, res) => {
  try {
    const collections = db.listCollections();
    const payload = {};
    for (const name of collections) {
      payload[name] = await db.getCollection(name);
    }
    res.json({ collections: payload });
  } catch (err) {
          logError('sync:collections', 'Erro ao sincronizar todas as coleções', err);
    res.status(500).json({ error: 'Erro ao carregar coleções.' });
  }
});

app.get('/sync/collection/:collection', requireSyncAuth, async (req, res) => {
  try {
    const { collection } = req.params;
    if (!db.listCollections().includes(collection)) {
      return res.status(400).json({ error: 'Colecao invalida.' });
    }

    const data = await db.getCollection(collection);
    const since = req.query.since;
    if (since) {
      const sinceMs = Date.parse(String(since));
      const wrapper = normalizeCollectionWrapper(data);
      if (!Number.isNaN(sinceMs) && wrapper) {
        const items = wrapper.items.filter((item) => {
          const ts = item.updatedAt || item.createdAt;
          if (!ts) return true;
          return Date.parse(ts) >= sinceMs;
        });
        const deleted = Array.isArray(wrapper.meta?.deleted)
          ? wrapper.meta.deleted.filter((entry) => {
              if (!entry.deletedAt) return true;
              return Date.parse(entry.deletedAt) >= sinceMs;
            })
          : [];

        return res.json({
          delta: true,
          items,
          meta: { deleted },
          since: String(since)
        });
      }
    }

    return res.json(data);
  } catch (err) {
          logError('sync:collection:get', 'Erro ao sincronizar coleção (GET)', err);
    res.status(500).json({ error: 'Erro ao carregar colecao.' });
  }
});

app.post('/sync/collection/:collection', requireSyncAuth, async (req, res) => {
  try {
    const { collection } = req.params;
    if (!db.listCollections().includes(collection)) {
      return res.status(400).json({ error: 'Colecao invalida.' });
    }
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload invalido.' });
    }

    if (payload.mode === 'delta') {
      const current = await db.getCollection(collection);
      const merged = applyDeltaToCollection(current, payload);
      await db.setCollection(collection, merged, { skipSync: true });
      return res.json({ success: true, mode: 'delta' });
    }

    if (payload.mode === 'full' && payload.data) {
      await db.setCollection(collection, payload.data, { skipSync: true });
      return res.json({ success: true, mode: 'full' });
    }

    await db.setCollection(collection, payload, { skipSync: true });
    return res.json({ success: true, mode: 'legacy' });
  } catch (err) {
          logError('sync:collection:post', 'Erro ao sincronizar coleção (POST)', err);
    res.status(500).json({ error: 'Erro ao salvar colecao.' });
  }
});

// ============================================================================
// 3.1. ENDPOINT DE BUSCA DE CLIENTE POR TELEFONE
// ============================================================================
//
// Usado pelo CheckoutPage para ver se o cliente já está cadastrado.
// GET /api/customers/by-phone?phone=11999999999
//
app.get('/api/customers/by-phone', async (req, res) => {
  try {
    const rawPhone = req.query.phone || '';
    const digits = rawPhone.replace(/\D/g, '');

    if (!digits || digits.length < 8) {
      return res
        .status(400)
        .json({ error: 'Parâmetro "phone" inválido ou muito curto.' });
    }

    const data = await db.getCollection('customers');
    const items = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
      ? data
      : [];

    const normalize = (p) => String(p || '').replace(/\D/g, '');

    const found = items.find((c) => normalize(c.phone || c.telefone) === digits);

    if (!found) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    // Retorna o registro completo do cliente
    return res.json(found);
  } catch (err) {
          logApiError(req, 'api:customers/by-phone', err);
    res.status(500).json({ error: 'Erro ao buscar cliente por telefone.' });
  }
});

// ============================================================================
// 3.2. VALIDAÇÃO E CADASTRO DE NOVOS CLIENTES (POST /api/customers)
// ============================================================================

function validateCustomerPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return ['Payload inválido.'];
  }

  if (
    !payload.name ||
    typeof payload.name !== 'string' ||
    payload.name.trim().length < 2
  ) {
    errors.push('Nome é obrigatório e deve ter pelo menos 2 caracteres.');
  }

  if (!payload.phone || typeof payload.phone !== 'string') {
    errors.push('Telefone é obrigatório.');
  } else {
    const digits = payload.phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      errors.push('Telefone deve ter 10 ou 11 dígitos (com DDD).');
    }
  }

  const addr = payload.address;
  if (!addr || typeof addr !== 'object') {
    errors.push('Endereço é obrigatório.');
  } else {
    if (!addr.cep) errors.push('CEP é obrigatório.');
    if (!addr.street) errors.push('Rua é obrigatória.');
    if (!addr.number) errors.push('Número é obrigatório.');
    if (!addr.neighborhood) errors.push('Bairro é obrigatório.');
    if (!addr.city) errors.push('Cidade é obrigatória.');
    if (!addr.state) errors.push('Estado é obrigatório.');
  }

  return errors;
}

// POST específico para clientes, com validação e checagem de duplicidade
app.post('/api/customers', async (req, res) => {
  try {
    const payload = req.body || {};

    // 1) Validação básica
    const errors = validateCustomerPayload(payload);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Dados de cliente inválidos.',
        errors
      });
    }

    // 2) Normalizar telefone e checar se já existe
    const normalizedPhone = payload.phone.replace(/\D/g, '');

    const data = await db.getCollection('customers');
    const items = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
      ? data
      : [];

    const normalize = (p) => String(p || '').replace(/\D/g, '');
    const existing = items.find(
      (c) => normalize(c.phone || c.telefone) === normalizedPhone
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Já existe um cliente cadastrado com esse telefone.',
        customer: existing
      });
    }

    // 3) Montar objeto do cliente
    const now = new Date().toISOString();

    const newCustomer = {
      // id será preenchido automaticamente pelo db.addItem se não informarmos
      name: payload.name.trim(),
      phone: normalizedPhone,
      whatsapp: Boolean(payload.whatsapp),
      document: payload.document || null,
      address: {
        cep: payload.address.cep,
        street: payload.address.street,
        number: payload.address.number,
        complement: payload.address.complement || '',
        neighborhood: payload.address.neighborhood,
        city: payload.address.city,
        state: payload.address.state,
        reference: payload.address.reference || ''
      },
      notes: payload.notes || '',
      source: payload.source || 'site',
      tags: Array.isArray(payload.tags) && payload.tags.length > 0
        ? payload.tags
        : ['novo'],
      totalOrders: 0,
      totalSpent: 0,
      createdAt: now,
      updatedAt: now
    };

    // 4) Salvar usando o DataEngine
    const created = await db.addItem('customers', newCustomer);

    return res.status(201).json({
      success: true,
      message: 'Cliente cadastrado com sucesso.',
      customer: created
    });
  } catch (err) {
          logApiError(req, 'api:customers:post', err);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao cadastrar cliente.'
    });
  }
});

// ============================================================================
// 3.3. ATUALIZAÇÃO DE STATUS DO MOTOBOY
// ============================================================================
//
// PUT /api/motoboys/:id/status
// Body esperado:
// {
//    "status": "available" | "delivering" | "offline"
// }
//
app.put('/api/motoboys/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    const allowed = ['available', 'delivering', 'offline'];

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status inválido. Use: available, delivering ou offline.'
      });
    }

    const now = new Date().toISOString();

    const updated = await db.updateItem('motoboys', id, {
      status,
      updatedAt: now
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Motoboy não encontrado.'
      });
    }

    return res.json({
      success: true,
      message: 'Status atualizado.',
      motoboy: updated
    });
  } catch (err) {
          logApiError(req, 'api:motoboys/status', err);
    res.status(500).json({
      success: false,
      message: 'Erro interno ao atualizar status do motoboy.'
    });
  }
});

// ============================================================================
// 3.4. CONSULTAR STATUS DO MOTOBOY
// ============================================================================
//
// GET /api/motoboys/:id/status
//
app.get('/api/motoboys/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    const data = await db.getCollection('motoboys');
    const items = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
      ? data
      : [];

    const found = items.find((m) => String(m.id) === String(id));

    if (!found) {
      return res.status(404).json({
        success: false,
        message: 'Motoboy não encontrado.'
      });
    }

    return res.json({
      success: true,
      id: found.id,
      status: found.status || 'available',
      isActive: found.isActive !== false
    });
  } catch (err) {
          logApiError(req, 'api:motoboys/getStatus', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao consultar status do motoboy.'
    });
  }
});

// ============================================================================
// 3.5. ROTA DE TRACKING DO PEDIDO PARA MOTOBOY (QR CODE)
// ============================================================================
//
// GET /motoboy/pedido/:orderId
// Exemplo: http://localhost:3030/motoboy/pedido/orders-1765312686786-74164
//
// Retorna um JSON simples com status do pedido e dados básicos do motoboy.
//
app.get('/motoboy/pedido/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // 1) Carrega pedidos
    const ordersData = await db.getCollection('orders');
    const orders = Array.isArray(ordersData?.items)
      ? ordersData.items
      : Array.isArray(ordersData)
      ? ordersData
      : [];

    const order =
      orders.find((o) => String(o.id) === String(orderId)) ||
      orders.find((o) => String(o.orderId) === String(orderId));

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado.'
      });
    }

    // 2) Tenta carregar dados do motoboy vinculado (se houver)
    let motoboyInfo = null;

    if (order.motoboyId) {
      const motoboysData = await db.getCollection('motoboys');
      const motoboys = Array.isArray(motoboysData?.items)
        ? motoboysData.items
        : Array.isArray(motoboysData)
        ? motoboysData
        : [];

      const motoboy = motoboys.find(
        (m) => String(m.id) === String(order.motoboyId)
      );

      if (motoboy) {
        motoboyInfo = {
          id: motoboy.id,
          name: motoboy.name,
          phone: motoboy.phone,
          status: motoboy.status || 'available',
          isActive: motoboy.isActive !== false
        };
      }
    }

    const { trackingUrl, trackingCode } = resolveTrackingPayload(order);
    const lastUpdatedAt =
      order.updatedAt || order.delivery?.updatedAt || order.createdAt || null;
    const motoboyStatus =
      order.motoboyStatus ||
      order.delivery?.motoboyStatus ||
      (motoboyInfo ? motoboyInfo.status : null);
    const motoboyUpdatedAt =
      order.delivery?.motoboyUpdatedAt ||
      order.delivery?.motoboyLinkedAt ||
      order.updatedAt ||
      null;

    // 3) Resposta enxuta pro app / QR
    return res.json({
      success: true,
      orderId: order.id || orderId,
      status: order.status || 'open',
      source: order.source || 'unknown',
      trackingUrl,
      trackingCode,
      lastUpdatedAt,
      motoboy: motoboyInfo,
      motoboyStatus,
      motoboyUpdatedAt,
      order
    });
  } catch (err) {
          logApiError(req, 'api:motoboy/pedido', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar pedido para tracking do motoboy.'
    });
  }
});

// ============================================================================
// 3.6. VÍNCULO DE MOTOBOY AO PEDIDO VIA QR TOKEN (SCAN)
// ============================================================================
//
// POST /motoboy/pedido/:orderId/link
//
// Body esperado:
// {
//   "qrToken": "qr-123..."   // token único do motoboy
// }
//
// Fluxo:
//  - encontra motoboy pelo qrToken
//  - vincula no pedido
//  - muda status do pedido para "out_for_delivery"
//  - muda status do motoboy para "delivering"
// ============================================================================

app.post('/motoboy/pedido/:orderId/link', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { qrToken } = req.body || {};

    if (!qrToken || typeof qrToken !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'qrToken é obrigatório no corpo da requisição.'
      });
    }

    const motoboysData = await db.getCollection('motoboys');
    const motoboys = Array.isArray(motoboysData?.items)
      ? motoboysData.items
      : Array.isArray(motoboysData)
      ? motoboysData
      : [];

    const motoboy = motoboys.find(
      (m) => String(m.qrToken || '').trim() === String(qrToken).trim()
    );

    if (!motoboy) {
      return res.status(404).json({
        success: false,
        message: 'Motoboy não encontrado para este qrToken.'
      });
    }

    const ordersData = await db.getCollection('orders');
    const orders = Array.isArray(ordersData?.items)
      ? ordersData.items
      : Array.isArray(ordersData)
      ? ordersData
      : [];

    const orderIndex = orders.findIndex(
      (o) =>
        String(o.id) === String(orderId) ||
        String(o.orderId) === String(orderId)
    );

    if (orderIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Pedido não encontrado.'
      });
    }

    const order = orders[orderIndex];
    const normalizedStatus = (order.status || '').toString().toLowerCase();
    const lockedStatuses = new Set(['out_for_delivery', 'done', 'cancelled']);
    if (lockedStatuses.has(normalizedStatus)) {
      const detail = `Pedido ${orderId} com status ${order.status} não pode ser aceito novamente (qrToken ${qrToken}).`;
      console.warn('[apiServer][motoboy/link] ' + detail);
      return res.status(409).json({
        success: false,
        message: 'Pedido já está em rota ou encerrado.',
        detail,
        status: order.status
      });
    }

    const now = new Date().toISOString();
    const motoboySnapshot = {
      id: motoboy.id,
      name: motoboy.name,
      phone: motoboy.phone,
      baseNeighborhood: motoboy.baseNeighborhood || null,
      baseFee: motoboy.baseFee ?? null
    };

    const updatedOrder = {
      ...order,
      status: 'out_for_delivery',
      motoboyId: motoboy.id,
      motoboyName: motoboy.name,
      motoboyPhone: motoboy.phone,
      motoboyBaseNeighborhood: motoboy.baseNeighborhood || null,
      motoboyBaseFee: motoboy.baseFee ?? null,
      motoboySnapshot,
      motoboyStatus: 'out_for_delivery',
      motoboyLinkedAt: now,
      delivery: {
        ...(order.delivery || {}),
        motoboyId: motoboy.id,
        motoboyName: motoboy.name,
        motoboyPhone: motoboy.phone,
        motoboyBaseNeighborhood: motoboy.baseNeighborhood || null,
        motoboyBaseFee: motoboy.baseFee ?? null,
        motoboySnapshot,
        motoboyStatus: 'out_for_delivery',
        motoboyUpdatedAt: now,
        motoboyLinkedAt: now
      },
      updatedAt: now
    };

    const savedOrder = await db.updateItem(
      'orders',
      order.id || orderId,
      updatedOrder
    );

    const trackedOrder = await persistOrderTracking(savedOrder);

    const updatedMotoboy = await db.updateItem('motoboys', motoboy.id, {
      status: 'delivering',
      updatedAt: now
    });

    const tracking = resolveTrackingPayload(trackedOrder);

    const responseMotoboy = {
      id: motoboy.id,
      name: motoboy.name,
      phone: motoboy.phone,
      status: updatedMotoboy?.status || 'delivering',
      updatedAt: updatedMotoboy?.updatedAt || now
    };

    orderEvents.emit('updated', trackedOrder);

    return res.json({
      success: true,
      message: 'Motoboy vinculado ao pedido com sucesso.',
      order: trackedOrder,
      motoboy: responseMotoboy,
      trackingUrl: tracking.trackingUrl,
      trackingCode: tracking.trackingCode
    });
  } catch (err) {
          logApiError(req, 'api:motoboy/link', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao vincular motoboy ao pedido via QR.'
    });
  }
});

// ============================================================================
// 4. ENDPOINTS GENÉRICOS EXISTENTES (mantidos)
// ============================================================================

// Healthcheck simples
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    dataDir: db.getDataDir(),
    collections: db.listCollections()
  });
});

// Listar coleção: GET /api/orders, /api/customers, etc.
app.get('/api/:collection', async (req, res) => {
  const { collection } = req.params;
  try {
    const data = await db.getCollection(collection);
    res.json(data);
  } catch (err) {
          logApiError(req, 'api:getCollection', err);
    res
      .status(400)
      .json({ error: err.message || 'Erro ao carregar coleção' });
  }
});

// Criar item genérico: POST /api/orders, /api/qualquer-coisa
// (clientes usam o POST específico acima: /api/customers)
app.post('/api/:collection', async (req, res) => {
  const { collection } = req.params;
  const payload = req.body;

  try {
    if (collection === 'orders') {
      const settings = await getOrderValidationSettings();
      const neighborhood = resolveOrderNeighborhood(payload);
      const blockedMatch = findBlockedNeighborhood(
        neighborhood,
        settings.blockedNeighborhoods
      );
      if (isDeliveryOrder(payload) && blockedMatch) {
        return res.status(422).json({
          error: 'NeighborhoodBlocked',
          message: `Não entregamos no bairro "${blockedMatch}".`,
          neighborhood: blockedMatch
        });
      }
      const businessStatus = getBusinessHoursStatus(settings.businessHours);
      if (!businessStatus.isOpen) {
        return res.status(422).json({
          error: 'BusinessHoursClosed',
          message: businessStatus.reason || 'Fora do horario de funcionamento.'
        });
      }

      if (isDeliveryOrder(payload)) {
        const subtotal = resolveOrderSubtotal(payload);
        if (settings.minOrderValue > 0 && subtotal < settings.minOrderValue) {
          return res.status(422).json({
            error: 'MinOrderValue',
            message: `Pedido minimo para entrega: ${settings.minOrderValue}.`,
            minOrderValue: settings.minOrderValue,
            subtotal
          });
        }

        const distanceKm = resolveOrderDistanceKm(payload);
        if (
          settings.maxDistanceKm > 0 &&
          distanceKm > 0 &&
          distanceKm > settings.maxDistanceKm
        ) {
          return res.status(422).json({
            error: 'MaxDistanceExceeded',
            message: `Distancia acima do maximo permitido (${settings.maxDistanceKm} km).`,
            maxDistanceKm: settings.maxDistanceKm,
            distanceKm
          });
        }
      }
    }

    const created = await db.addItem(collection, payload);
    let responsePayload = created;
    if (collection === 'orders') {
      responsePayload = await persistOrderTracking(created);
      orderEvents.emit('created', responsePayload);
    }
    res.status(201).json(responsePayload);
  } catch (err) {
          logApiError(req, 'api:addItem', err);
    res
      .status(400)
      .json({ error: err.message || 'Erro ao adicionar item' });
  }
});

// Atualizar item por id: PUT /api/orders/:id
app.put('/api/:collection/:id', async (req, res) => {
  const { collection, id } = req.params;
  const changes = req.body;

  try {
    if (collection === 'orders') {
      const data = await db.getCollection('orders');
      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];
      const existing = items.find((o) => String(o.id) === String(id)) || null;

      const merged = {
        ...(existing || {}),
        ...(changes || {})
      };
      if (existing?.delivery || changes?.delivery) {
        merged.delivery = {
          ...(existing?.delivery || {}),
          ...(changes?.delivery || {})
        };
      }

      const settings = await getOrderValidationSettings();
      const neighborhood = resolveOrderNeighborhood(merged);
      const blockedMatch = findBlockedNeighborhood(
        neighborhood,
        settings.blockedNeighborhoods
      );
      if (isDeliveryOrder(merged) && blockedMatch) {
        return res.status(422).json({
          error: 'NeighborhoodBlocked',
          message: `Não entregamos no bairro "${blockedMatch}".`,
          neighborhood: blockedMatch
        });
      }
      const shouldValidate = shouldValidateDeliveryChanges(changes);
      if (shouldValidate) {
        const businessStatus = getBusinessHoursStatus(settings.businessHours);
        if (!businessStatus.isOpen) {
          return res.status(422).json({
            error: 'BusinessHoursClosed',
            message:
              businessStatus.reason || 'Fora do horario de funcionamento.'
          });
        }

        if (isDeliveryOrder(merged)) {
          const subtotal = resolveOrderSubtotal(merged);
          if (
            settings.minOrderValue > 0 &&
            subtotal < settings.minOrderValue
          ) {
            return res.status(422).json({
              error: 'MinOrderValue',
              message: `Pedido minimo para entrega: ${settings.minOrderValue}.`,
              minOrderValue: settings.minOrderValue,
              subtotal
            });
          }

          const distanceKm = resolveOrderDistanceKm(merged);
          if (
            settings.maxDistanceKm > 0 &&
            distanceKm > 0 &&
            distanceKm > settings.maxDistanceKm
          ) {
            return res.status(422).json({
              error: 'MaxDistanceExceeded',
              message: `Distancia acima do maximo permitido (${settings.maxDistanceKm} km).`,
              maxDistanceKm: settings.maxDistanceKm,
              distanceKm
            });
          }
        }
      }
    }

    const updated = await db.updateItem(collection, id, changes);
    let responsePayload = updated;
    if (collection === 'orders') {
      responsePayload = await persistOrderTracking(updated);
      orderEvents.emit('updated', responsePayload);
    }
    res.json(responsePayload);
  } catch (err) {
          logApiError(req, 'api:updateItem', err);
    res
      .status(400)
      .json({ error: err.message || 'Erro ao atualizar item' });
  }
});

// Remover item: DELETE /api/orders/:id
app.delete('/api/:collection/:id', async (req, res) => {
  const { collection, id } = req.params;

  try {
    const removed = await db.removeItem(collection, id);
    res.json(removed);
  } catch (err) {
          logApiError(req, 'api:removeItem', err);
    res
      .status(400)
      .json({ error: err.message || 'Erro ao remover item' });
  }
});

// Resetar coleção: POST /api/orders/reset
app.post('/api/:collection/reset', async (req, res) => {
  const { collection } = req.params;

  try {
    const result = await db.resetCollection(collection);
    res.json(result);
  } catch (err) {
          logApiError(req, 'api:resetCollection', err);
    res
      .status(400)
      .json({ error: err.message || 'Erro ao resetar coleção' });
  }
});

// ============================================================================
// 5. INÍCIO DO SERVIDOR
// ============================================================================
if (require.main === module) {
  startApiServer().catch((err) => {
    logError('apiServer', 'Unable to start embedded API server', err, {
      portStart: EMBEDDED_API_PORT,
      portMax: EMBEDDED_API_PORT_MAX
    });
    process.exit(1);
  });
}

module.exports = app;
module.exports.orderEvents = orderEvents;
module.exports.getTrackingBaseUrl = getTrackingBaseUrl;
module.exports.startApiServer = startApiServer;
module.exports.getCurrentApiPort = () => currentApiPort;
