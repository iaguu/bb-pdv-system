
// electron/apiServer.js
// Servidor HTTP/REST para expor o DataEngine via HTTP (site, app, integra��es)

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { EventEmitter } = require('events');
require('dotenv').config();
const fetchFn = global.fetch
  ? global.fetch
  : (...args) =>
      import('node-fetch').then(({ default: fetch }) => fetch(...args));


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

  if (['pickup', 'retirada', 'counter', 'balcao', 'balc�o', 'local'].includes(typeRaw)) {
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

function normalizeBusinessHoursConfig(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const openTime = input.openTime || '11:00';
  const closeTime = input.closeTime || '23:00';
  const closedWeekdays = Array.isArray(input.closedWeekdays)
    ? input.closedWeekdays
    : [];
  const baseSchedule = buildWeeklySchedule(openTime, closeTime, closedWeekdays);
  const rawSchedule = Array.isArray(input.weeklySchedule)
    ? input.weeklySchedule
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
    enabled: !!input.enabled,
    openTime,
    closeTime,
    closedWeekdays: normalizedClosedWeekdays,
    weeklySchedule
  };
}

function syncBusinessHoursTimes(previousRaw, nextRaw) {
  const previous = normalizeBusinessHoursConfig(previousRaw);
  const next = normalizeBusinessHoursConfig(nextRaw);
  const nextOpen = next.openTime;
  const nextClose = next.closeTime;

  const schedule = Array.isArray(next.weeklySchedule)
    ? next.weeklySchedule.map((entry) => {
        const updated = { ...entry };
        if (previous.openTime && updated.openTime === previous.openTime) {
          updated.openTime = nextOpen;
        }
        if (previous.closeTime && updated.closeTime === previous.closeTime) {
          updated.closeTime = nextClose;
        }
        if (!updated.openTime) updated.openTime = nextOpen;
        if (!updated.closeTime) updated.closeTime = nextClose;
        return updated;
      })
    : buildWeeklySchedule(nextOpen, nextClose, next.closedWeekdays);

  const normalizedClosedWeekdays = schedule
    .filter((entry) => entry.enabled === false)
    .map((entry) => entry.day);

  return {
    ...next,
    openTime: nextOpen,
    closeTime: nextClose,
    closedWeekdays: normalizedClosedWeekdays,
    weeklySchedule: schedule
  };
}

function syncSettingsItem(previous, next) {
  if (!next || typeof next !== 'object') return next;
  const prevHours =
    previous && typeof previous === 'object' ? previous.businessHours : null;
  const nextHours = next.businessHours;
  if (!prevHours && !nextHours) return next;

  const mergedHours = nextHours
    ? {
        ...(prevHours && typeof prevHours === 'object' ? prevHours : {}),
        ...nextHours
      }
    : prevHours;
  if (!mergedHours) return next;

  return {
    ...next,
    businessHours: syncBusinessHoursTimes(prevHours, mergedHours)
  };
}

function syncSettingsData(currentData, nextData) {
  const currentWrapper = normalizeCollectionWrapper(currentData);
  const currentItems = currentWrapper
    ? currentWrapper.items
    : Array.isArray(currentData)
    ? currentData
    : currentData && typeof currentData === 'object'
    ? [currentData]
    : [];
  const currentById = new Map(
    currentItems
      .filter((item) => item && typeof item === 'object')
      .map((item) => [String(item.id || 'default'), item])
  );

  const syncItem = (item) => {
    if (!item || typeof item !== 'object') return item;
    const prev =
      currentById.get(String(item.id || 'default')) ||
      currentById.get('default') ||
      null;
    return syncSettingsItem(prev, item);
  };

  if (nextData && Array.isArray(nextData.items)) {
    return {
      ...nextData,
      items: nextData.items.map(syncItem)
    };
  }

  if (Array.isArray(nextData)) {
    return nextData.map(syncItem);
  }

  if (nextData && typeof nextData === 'object') {
    return syncItem(nextData);
  }

  return nextData;
}

function normalizeDeliveryConfig(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const peakFee = input.peakFee && typeof input.peakFee === 'object'
    ? input.peakFee
    : {};
  const etaRaw =
    input.etaMinutesDefault === null || input.etaMinutesDefault === undefined
      ? 45
      : input.etaMinutesDefault;
  return {
    mode: input.mode || 'km_table',
    baseLocationLabel: input.baseLocationLabel || null,
    minOrderValue: parseNumberValue(input.minOrderValue),
    maxDistanceKm: parseNumberValue(input.maxDistanceKm),
    etaMinutesDefault: parseNumberValue(etaRaw),
    blockedNeighborhoods: Array.isArray(input.blockedNeighborhoods)
      ? input.blockedNeighborhoods.filter(Boolean)
      : [],
    peakFee: {
      enabled: !!peakFee.enabled,
      days: Array.isArray(peakFee.days) ? peakFee.days : [],
      startTime: peakFee.startTime || '18:00',
      endTime: peakFee.endTime || '22:00',
      amount: parseNumberValue(peakFee.amount)
    },
    ranges: Array.isArray(input.ranges) ? input.ranges : []
  };
}

function normalizePdvSettings(rawSettings) {
  const item = normalizeSettingsData(rawSettings) || {};
  const businessHours = normalizeBusinessHoursConfig(item.businessHours);
  const delivery = normalizeDeliveryConfig(item.delivery);
  const pizzariaName =
    item.pizzariaName ||
    item.pizzaria ||
    item.pizzariaNome ||
    item.name ||
    'AXION PDV';

  return {
    ...item,
    pizzariaName,
    version: item.versao || item.version || null,
    theme: item.tema || item.theme || null,
    businessHours,
    delivery
  };
}

function buildPdvFeatureFlags(settings) {
  const delivery = settings.delivery || {};
  const printing = settings.printing || {};
  const apiConfig = settings.api || {};
  const businessHours = settings.businessHours || {};
  const hasDeliveryRanges =
    Array.isArray(delivery.ranges) && delivery.ranges.length > 0;
  const hasPrinters = Boolean(
    printing.kitchenPrinterName || printing.counterPrinterName
  );
  const trackingBaseUrl = getTrackingBaseUrl();

  return {
    businessHours: {
      enabled: !!businessHours.enabled
    },
    delivery: {
      enabled:
        hasDeliveryRanges ||
        delivery.mode ||
        delivery.minOrderValue > 0 ||
        delivery.maxDistanceKm > 0 ||
        (Array.isArray(delivery.blockedNeighborhoods) &&
          delivery.blockedNeighborhoods.length > 0),
      mode: delivery.mode || 'km_table'
    },
    printing: {
      enabled: hasPrinters || printing.silentMode === true,
      kitchenPrinterName: printing.kitchenPrinterName || null,
      counterPrinterName: printing.counterPrinterName || null,
      silentMode: printing.silentMode !== false
    },
    api: {
      enabled: Boolean(apiConfig.base_url || apiConfig.api_key),
      baseUrl: apiConfig.base_url || null
    },
    tracking: {
      enabled: Boolean(trackingBaseUrl),
      baseUrl: trackingBaseUrl || null
    },
    sync: {
      enabled: Boolean(process.env.SYNC_BASE_URL),
      baseUrl: process.env.SYNC_BASE_URL || null
    },
    custom: settings.features || {}
  };
}

function normalizeProductsList(raw) {
  if (raw && Array.isArray(raw.products)) return raw.products;
  if (raw && Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw)) return raw;
  return [];
}

function getProductDisplayName(product) {
  return (
    product.name ||
    product.nome ||
    product.title ||
    product.description ||
    'Sem nome'
  );
}

function buildDisabledProductsPayload(raw) {
  const products = normalizeProductsList(raw);
  const disabled = [];

  for (const product of products) {
    if (!product || typeof product !== 'object') continue;
    const isActive = product.active !== false;
    const isAvailable = product.isAvailable !== false;
    const manualOutOfStock = product._manualOutOfStock === true;
    const isDisabled = !isActive || !isAvailable || manualOutOfStock;
    if (!isDisabled) continue;

    const reasons = [];
    if (!isActive) reasons.push('inactive');
    if (!isAvailable) reasons.push('unavailable');
    if (manualOutOfStock) reasons.push('manual_out_of_stock');

    disabled.push({
      id: product.id || null,
      sku: product.sku || null,
      name: getProductDisplayName(product),
      type: product.type || product.category || null,
      category: product.categoria || product.category || null,
      active: isActive,
      isAvailable,
      manualOutOfStock,
      reasons
    });
  }

  return {
    success: true,
    total: products.length,
    disabledCount: disabled.length,
    activeCount: Math.max(0, products.length - disabled.length),
    items: disabled
  };
}

function buildProductAvailabilityList(raw) {
  const products = normalizeProductsList(raw);
  const items = [];
  let activeCount = 0;
  let disabledCount = 0;
  let manualOutOfStockCount = 0;
  let autoPausedCount = 0;

  for (const product of products) {
    if (!product || typeof product !== 'object') continue;
    const isActive = product.active !== false;
    const isAvailable = product.isAvailable !== false;
    const manualOutOfStock = product._manualOutOfStock === true;
    const autoPausedByStock = product._autoPausedByStock === true;
    const isDisabled = !isActive || !isAvailable || manualOutOfStock;
    const status = isDisabled ? 'paused' : 'active';

    if (isDisabled) disabledCount += 1;
    else activeCount += 1;
    if (manualOutOfStock) manualOutOfStockCount += 1;
    if (autoPausedByStock) autoPausedCount += 1;

    const reasons = [];
    if (!isActive) reasons.push('inactive');
    if (!isAvailable) reasons.push('unavailable');
    if (manualOutOfStock) reasons.push('manual_out_of_stock');
    if (autoPausedByStock) reasons.push('auto_paused_by_stock');

    items.push({
      id: product.id || null,
      sku: product.sku || null,
      name: getProductDisplayName(product),
      type: product.type || product.category || null,
      category: product.categoria || product.category || null,
      status,
      active: isActive,
      isAvailable,
      manualOutOfStock,
      autoPausedByStock,
      reasons
    });
  }

  return {
    total: products.length,
    activeCount,
    disabledCount,
    manualOutOfStockCount,
    autoPausedCount,
    items
  };
}

function normalizeIngredientKey(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

function normalizeStockIngredients(raw) {
  if (raw && Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw)) return raw;
  return [];
}

function buildStockAlertsPayload(productsRaw, stockRaw) {
  const products = normalizeProductsList(productsRaw);
  const stockItems = normalizeStockIngredients(stockRaw);
  const ingredientMap = new Map();

  for (const item of stockItems) {
    if (!item || typeof item !== 'object') continue;
    const key = normalizeIngredientKey(
      item.key || item.name || item.ingrediente
    );
    if (!key) continue;
    ingredientMap.set(key, {
      key,
      name: item.name || item.ingrediente || item.key || key,
      quantity: Number(item.quantity ?? 0),
      minQuantity: Number(item.minQuantity ?? 0),
      unavailable: Boolean(item.unavailable)
    });
  }

  const missing = [];
  for (const entry of ingredientMap.values()) {
    const qty = Number(entry.quantity ?? 0);
    const min = Number(entry.minQuantity ?? 0);
    if (entry.unavailable || (min > 0 && qty <= 0)) {
      missing.push(entry);
    }
  }

  const missingKeys = new Set(missing.map((item) => item.key));
  const affectedProducts = [];

  for (const product of products) {
    if (!product || typeof product !== 'object') continue;
    const type = (product.type || '').toLowerCase();
    if (type !== 'pizza') continue;
    const ingredientes = Array.isArray(product.ingredientes)
      ? product.ingredientes
      : [];
    const missingForProduct = ingredientes
      .map(normalizeIngredientKey)
      .filter((key) => missingKeys.has(key));
    if (!missingForProduct.length) continue;

    affectedProducts.push({
      id: product.id || null,
      name: getProductDisplayName(product),
      type: product.type || null,
      category: product.categoria || product.category || null,
      missingIngredients: Array.from(new Set(missingForProduct))
    });
  }

  return {
    success: true,
    totalIngredients: ingredientMap.size,
    missingIngredientsCount: missing.length,
    affectedProductsCount: affectedProducts.length,
    missingIngredients: missing,
    affectedProducts,
    hasStockData: stockItems.length > 0
  };
}

function parseKmValue(value) {
  return Math.max(0, parseNumberValue(value));
}

function isWithinPeakWindow(peakFee, date = new Date()) {
  if (!peakFee?.enabled) return false;
  const days = Array.isArray(peakFee.days) ? peakFee.days : [];
  const weekday = date.getDay();
  if (days.length > 0 && !days.includes(weekday)) return false;
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutes = parseTimeToMinutes(peakFee.startTime);
  const endMinutes = parseTimeToMinutes(peakFee.endTime);
  return isWithinTimeRange(nowMinutes, startMinutes, endMinutes);
}

function findDeliveryRangeForKm(distanceKm, deliveryConfig) {
  if (!deliveryConfig || !Array.isArray(deliveryConfig.ranges)) return null;
  const km = parseKmValue(distanceKm);
  if (km <= 0) return null;

  for (const range of deliveryConfig.ranges) {
    const min = parseKmValue(range.minKm);
    const max = parseKmValue(range.maxKm);
    if (km >= min && km <= max) {
      return range;
    }
  }

  return deliveryConfig.ranges[deliveryConfig.ranges.length - 1] || null;
}

function resolveOrderType(raw) {
  const value = raw === undefined || raw === null ? '' : String(raw);
  const normalized = value.toLowerCase().trim();
  if (!normalized) return 'delivery';
  if (['pickup', 'retirada', 'counter', 'balcao', 'local'].includes(normalized)) {
    return 'pickup';
  }
  if (['delivery', 'entrega'].includes(normalized)) {
    return 'delivery';
  }
  return normalized;
}

function normalizeOrderStatus(status) {
  if (!status) return 'open';
  return String(status).toLowerCase().trim();
}

function resolveOrderDiscount(order) {
  if (!order || typeof order !== 'object') return 0;
  if (typeof order.discount === 'object' && order.discount) {
    return parseNumberValue(order.discount.amount);
  }
  if (order.discount !== undefined && order.discount !== null) {
    return parseNumberValue(order.discount);
  }
  if (typeof order?.totals?.discount === 'number') {
    return parseNumberValue(order.totals.discount);
  }
  if (typeof order?.totals?.discountAmount === 'number') {
    return parseNumberValue(order.totals.discountAmount);
  }
  return 0;
}

function resolveOrderDeliveryFee(order) {
  if (!order || typeof order !== 'object') return 0;
  if (typeof order.deliveryFee === 'number') return parseNumberValue(order.deliveryFee);
  if (typeof order?.delivery?.fee === 'number') return parseNumberValue(order.delivery.fee);
  if (typeof order?.totals?.deliveryFee === 'number') {
    return parseNumberValue(order.totals.deliveryFee);
  }
  return 0;
}

function resolveOrderGrandTotal(order) {
  if (!order || typeof order !== 'object') return 0;
  if (typeof order.total === 'number') return parseNumberValue(order.total);
  if (typeof order?.totals?.finalTotal === 'number') {
    return parseNumberValue(order.totals.finalTotal);
  }
  const subtotal = resolveOrderSubtotal(order);
  const deliveryFee = resolveOrderDeliveryFee(order);
  const discount = resolveOrderDiscount(order);
  return Math.max(0, subtotal + deliveryFee - discount);
}

function parseDateValue(value) {
  if (!value) return null;
  const ts = Date.parse(String(value));
  if (Number.isNaN(ts)) return null;
  return new Date(ts);
}

function resolveOrderTimestamp(order) {
  if (!order || typeof order !== 'object') return null;
  const raw = order.createdAt || order.updatedAt || order.meta?.createdAt || null;
  if (!raw) return null;
  const ts = Date.parse(String(raw));
  if (Number.isNaN(ts)) return null;
  return new Date(ts);
}

function diffInDaysFromToday(rawDate) {
  if (!rawDate) return Infinity;
  const ts = Date.parse(String(rawDate));
  if (Number.isNaN(ts)) return Infinity;
  const diffMs = Date.now() - ts;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
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
 * Log estruturado de erro de API, com dados da requisi��o
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
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const AXIONPAY_BASE_URL = (
  process.env.AXIONPAY_BASE_URL || 'http://localhost:3060'
).trim().replace(/\/+$/, '');
const AXIONPAY_API_KEY = process.env.AXIONPAY_API_KEY || '';
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 120);
const BUSINESS_HOURS_SYNC_INTERVAL_MS = Number(
  process.env.BUSINESS_HOURS_SYNC_INTERVAL_MS || 5 * 60 * 1000
);
const BUSINESS_HOURS_SYNC_TIMEOUT_MS = Number(
  process.env.BUSINESS_HOURS_SYNC_TIMEOUT_MS || 6000
);
const BUSINESS_HOURS_SYNC_BASE_URL = (
  process.env.BUSINESS_HOURS_SYNC_BASE_URL ||
  process.env.SYNC_BASE_URL ||
  ''
).trim();
const rateStore = new Map();

let currentApiPort = EMBEDDED_API_PORT;
let serverInstance = null;
let businessHoursSyncTimer = null;
let businessHoursSyncInProgress = false;
let businessHoursLastSyncAt = null;

function getBusinessHoursSyncBaseUrl() {
  if (!BUSINESS_HOURS_SYNC_BASE_URL) return '';
  return BUSINESS_HOURS_SYNC_BASE_URL.replace(/\/+$/, '');
}

function getBusinessHoursSyncHeaders() {
  const headers = { Accept: 'application/json' };
  const apiKey =
    process.env.BUSINESS_HOURS_SYNC_API_KEY || PUBLIC_API_TOKEN || '';
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }
  if (process.env.SYNC_TOKEN) {
    headers['x-sync-token'] = process.env.SYNC_TOKEN;
  }
  return headers;
}

function normalizeBusinessHoursSnapshot(businessHours) {
  const normalized = normalizeBusinessHoursConfig(businessHours);
  const closedWeekdays = Array.isArray(normalized.closedWeekdays)
    ? normalized.closedWeekdays
        .map((day) => Number(day))
        .filter((day) => Number.isFinite(day))
        .sort((a, b) => a - b)
    : [];
  const weeklySchedule = Array.isArray(normalized.weeklySchedule)
    ? normalized.weeklySchedule
        .map((entry) => ({
          day: Number(entry.day),
          enabled: entry.enabled !== false,
          openTime: entry.openTime || '',
          closeTime: entry.closeTime || ''
        }))
        .sort((a, b) => a.day - b.day)
    : [];
  return {
    enabled: !!normalized.enabled,
    openTime: normalized.openTime || '',
    closeTime: normalized.closeTime || '',
    closedWeekdays,
    weeklySchedule
  };
}

function areBusinessHoursEqual(current, incoming) {
  const a = normalizeBusinessHoursSnapshot(current);
  const b = normalizeBusinessHoursSnapshot(incoming);
  return JSON.stringify(a) === JSON.stringify(b);
}

async function fetchJsonWithTimeout(url, options = {}) {
  if (typeof AbortController === 'undefined') {
    return fetchFn(url, options);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, BUSINESS_HOURS_SYNC_TIMEOUT_MS);

  try {
    return await fetchFn(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRemoteBusinessHours(baseUrl) {
  const endpoints = ['/api/pdv/business-hours', '/api/pdv/settings'];
  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    const response = await fetchJsonWithTimeout(url, {
      method: 'GET',
      headers: getBusinessHoursSyncHeaders()
    });

    if (!response.ok) {
      continue;
    }

    const data = await response.json().catch(() => null);
    const businessHours =
      data?.businessHours || data?.settings?.businessHours || null;
    if (businessHours) {
      return { businessHours, sourceUrl: url };
    }
  }

  return null;
}

async function syncBusinessHoursFromRemote(reason = 'interval') {
  const baseUrl = getBusinessHoursSyncBaseUrl();
  if (!baseUrl || BUSINESS_HOURS_SYNC_INTERVAL_MS <= 0) {
    return { success: false, skipped: true };
  }

  if (businessHoursSyncInProgress) {
    return { success: false, skipped: true, reason: 'in_progress' };
  }

  businessHoursSyncInProgress = true;

  try {
    const result = await fetchRemoteBusinessHours(baseUrl);
    if (!result?.businessHours) {
      logWarn('businessHoursSync', 'Nenhum horario encontrado para sincronizar.', {
        baseUrl
      });
      return { success: false, skipped: true, reason: 'empty' };
    }

    const normalizedIncoming = normalizeBusinessHoursConfig(result.businessHours);
    const settingsRaw = await db.getCollection('settings');
    const settings = normalizeSettingsData(settingsRaw) || null;
    const currentHours = settings?.businessHours || null;

    if (currentHours && areBusinessHoursEqual(currentHours, normalizedIncoming)) {
      businessHoursLastSyncAt = nowISO();
      return { success: true, updated: false };
    }

    const updates = {
      businessHours: normalizedIncoming,
      updatedAt: nowISO()
    };

    if (settings?.id) {
      await db.updateItem('settings', settings.id, updates, { skipSync: true });
    } else {
      const payload = {
        items: [
          {
            id: 'default',
            ...updates
          }
        ]
      };
      await db.setCollection('settings', payload, { skipSync: true });
    }

    businessHoursLastSyncAt = nowISO();
    logInfo(
      'businessHoursSync',
      'Horarios sincronizados.',
      {
        sourceUrl: result.sourceUrl,
        openTime: normalizedIncoming.openTime,
        closeTime: normalizedIncoming.closeTime,
        reason
      }
    );

    return { success: true, updated: true };
  } catch (err) {
    logError('businessHoursSync', 'Erro ao sincronizar horarios', err, {
      baseUrl,
      reason
    });
    return { success: false, error: String(err) };
  } finally {
    businessHoursSyncInProgress = false;
  }
}

function startBusinessHoursAutoSync() {
  const baseUrl = getBusinessHoursSyncBaseUrl();
  if (!baseUrl || BUSINESS_HOURS_SYNC_INTERVAL_MS <= 0) return;
  if (businessHoursSyncTimer) return;

  logInfo('businessHoursSync', 'Sincronia automatica habilitada.', {
    baseUrl,
    intervalMs: BUSINESS_HOURS_SYNC_INTERVAL_MS
  });

  void syncBusinessHoursFromRemote('startup');
  businessHoursSyncTimer = setInterval(() => {
    void syncBusinessHoursFromRemote('interval');
  }, BUSINESS_HOURS_SYNC_INTERVAL_MS);
}

function stopBusinessHoursAutoSync() {
  if (!businessHoursSyncTimer) return;
  clearInterval(businessHoursSyncTimer);
  businessHoursSyncTimer = null;
}

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
        startBusinessHoursAutoSync();
        serverInstance.on('close', () => {
          stopBusinessHoursAutoSync();
        });
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

// Normaliza qualquer formato poss�vel do products.json
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

// Atribui requestId e registra in�cio da requisi��o
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
          // usa nosso logger para n�o perder padr�o
          logInfo('http', msg.trim());
        }
      }
    }
  )
);

app.use(express.json({ limit: '10mb' }));

const DEV_ORIGIN_PATTERNS = [
  /^http:\/\/localhost(?::\d+)?$/,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
  /^http:\/\/\[::1\](?::\d+)?$/
];

// CORS TOTALMENTE LIBERADO (qualquer origem, qualquer header, qualquer método básico)
app.use(cors());
app.options('*', cors());

// Log de sa�da com tempo preciso (hrtime)
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
      console.error('[log][http-res] erro ao calcular dura��o:', e);
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

    logWarn('auth', 'Chave de API inv�lida ou ausente', {
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
// 3. ENDPOINT OFICIAL DO CARD�PIO (NOVO)
// ============================================================================
//
// O site SEMPRE vai ler o card�pio daqui: GET /api/menu
// Este endpoint usa o db.js (DATA_DIR) para manter o mesmo banco da API.\r\n//
app.get('/api/menu', async (req, res) => {
  try {
    const raw = await db.getCollection('products');
    const payload = normalizeProducts(raw);
    const products = Array.isArray(payload.products) ? payload.products : [];
    const filtered = products.filter((product) => {
      if (!product || typeof product !== 'object') return false;
      const isActive = product.active !== false;
      const isAvailable = product.isAvailable !== false;
      const manualOutOfStock = product._manualOutOfStock === true;
      const autoPausedByStock = product._autoPausedByStock === true;
      return (
        isActive &&
        isAvailable &&
        !manualOutOfStock &&
        !autoPausedByStock
      );
    });
    res.json({ ...payload, products: filtered });
  } catch (err) {
          logApiError(req, 'api:menu', err);
    res.status(500).json({
      error: 'Falha ao carregar card�pio oficial.'
    });
  }
});

// ============================================================================
// 3.0. PDV SETTINGS + FEATURES (NEW)
// ============================================================================
app.get('/api/pdv/settings', async (req, res) => {
  try {
    const settingsRaw = await db.getCollection('settings');
    const settings = normalizePdvSettings(settingsRaw);
    const businessStatus = getBusinessHoursStatus(settings.businessHours);
    const productsRaw = await db.getCollection('products');
    const disabledSummary = buildDisabledProductsPayload(productsRaw);

    res.json({
      success: true,
      settings,
      businessHours: settings.businessHours,
      businessStatus,
      closingTime: settings.businessHours.closeTime,
      features: buildPdvFeatureFlags(settings),
      disabledProducts: {
        total: disabledSummary.total,
        disabledCount: disabledSummary.disabledCount,
        activeCount: disabledSummary.activeCount
      },
      serverTime: nowISO()
    });
  } catch (err) {
    logApiError(req, 'api:pdv:settings', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar configuracoes do PDV.'
    });
  }
});

app.get('/api/pdv/business-hours', async (req, res) => {
  try {
    const settingsRaw = await db.getCollection('settings');
    const settings = normalizePdvSettings(settingsRaw);
    const status = getBusinessHoursStatus(settings.businessHours);

    res.json({
      success: true,
      businessHours: settings.businessHours,
      status,
      closingTime: settings.businessHours.closeTime,
      serverTime: nowISO()
    });
  } catch (err) {
    logApiError(req, 'api:pdv:business-hours', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar horario de funcionamento.'
    });
  }
});

app.get('/api/pdv/products/disabled', async (req, res) => {
  try {
    const raw = await db.getCollection('products');
    const payload = buildDisabledProductsPayload(raw);
    res.json(payload);
  } catch (err) {
    logApiError(req, 'api:pdv:products:disabled', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar produtos desativados.'
    });
  }
});

app.get('/api/pdv/features', async (req, res) => {
  try {
    const settingsRaw = await db.getCollection('settings');
    const settings = normalizePdvSettings(settingsRaw);
    res.json({
      success: true,
      features: buildPdvFeatureFlags(settings)
    });
  } catch (err) {
    logApiError(req, 'api:pdv:features', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar features do PDV.'
    });
  }
});

app.get('/api/pdv/summary', async (req, res) => {
  try {
    const settingsRaw = await db.getCollection('settings');
    const settings = normalizePdvSettings(settingsRaw);
    const businessStatus = getBusinessHoursStatus(settings.businessHours);
    const productsRaw = await db.getCollection('products');
    const availability = buildProductAvailabilityList(productsRaw);

    res.json({
      success: true,
      businessStatus,
      closingTime: settings.businessHours.closeTime,
      products: {
        total: availability.total,
        active: availability.activeCount,
        disabled: availability.disabledCount,
        manualOutOfStock: availability.manualOutOfStockCount,
        autoPausedByStock: availability.autoPausedCount
      },
      features: buildPdvFeatureFlags(settings),
      serverTime: nowISO()
    });
  } catch (err) {
    logApiError(req, 'api:pdv:summary', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar resumo do PDV.'
    });
  }
});

app.get('/api/pdv/delivery/quote', async (req, res) => {
  try {
    const settingsRaw = await db.getCollection('settings');
    const settings = normalizePdvSettings(settingsRaw);
    const delivery = settings.delivery || {};
    const businessStatus = getBusinessHoursStatus(settings.businessHours);

    const orderType = resolveOrderType(
      req.query.orderType || req.query.type || req.query.mode
    );
    const isDelivery = orderType !== 'pickup';
    const neighborhood = req.query.neighborhood || req.query.bairro || '';
    const distanceKm = parseKmValue(
      req.query.distanceKm || req.query.distance || req.query.km
    );
    const subtotal = parseNumberValue(
      req.query.subtotal || req.query.total || req.query.orderSubtotal
    );

    const blockedMatch = isDelivery
      ? findBlockedNeighborhood(neighborhood, delivery.blockedNeighborhoods)
      : null;
    const range = isDelivery
      ? findDeliveryRangeForKm(distanceKm, delivery)
      : null;
    const baseFee = isDelivery && range
      ? parseNumberValue(range.price ?? range.fee ?? range.value ?? 0)
      : 0;
    const peakFee =
      isDelivery && isWithinPeakWindow(delivery.peakFee)
        ? parseNumberValue(delivery.peakFee.amount)
        : 0;
    const totalFee = isDelivery ? baseFee + peakFee : 0;

    const violations = [];
    if (!businessStatus.isOpen) violations.push('BusinessHoursClosed');
    if (isDelivery && blockedMatch) violations.push('NeighborhoodBlocked');
    if (isDelivery && delivery.minOrderValue > 0 && subtotal < delivery.minOrderValue) {
      violations.push('MinOrderValue');
    }
    if (isDelivery && delivery.maxDistanceKm > 0 && distanceKm > 0 && distanceKm > delivery.maxDistanceKm) {
      violations.push('MaxDistanceExceeded');
    }

    res.json({
      success: true,
      input: {
        orderType,
        neighborhood,
        distanceKm,
        subtotal
      },
      validation: {
        isDelivery,
        blockedNeighborhood: blockedMatch,
        minOrderValue: delivery.minOrderValue,
        maxDistanceKm: delivery.maxDistanceKm,
        violations,
        isEligible: violations.length === 0
      },
      delivery: {
        range: range
          ? {
              id: range.id || null,
              label: range.label || null,
              minKm: range.minKm ?? null,
              maxKm: range.maxKm ?? null,
              price: parseNumberValue(range.price ?? range.fee ?? range.value ?? 0)
            }
          : null,
        baseFee,
        peakFee,
        totalFee,
        etaMinutesDefault: delivery.etaMinutesDefault
      },
      businessStatus,
      serverTime: nowISO()
    });
  } catch (err) {
    logApiError(req, 'api:pdv:delivery:quote', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao calcular cotacao de entrega.'
    });
  }
});

app.get('/api/pdv/products/availability', async (req, res) => {
  try {
    const raw = await db.getCollection('products');
    const availability = buildProductAvailabilityList(raw);
    res.json({
      success: true,
      total: availability.total,
      activeCount: availability.activeCount,
      disabledCount: availability.disabledCount,
      manualOutOfStockCount: availability.manualOutOfStockCount,
      autoPausedCount: availability.autoPausedCount,
      items: availability.items
    });
  } catch (err) {
    logApiError(req, 'api:pdv:products:availability', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar disponibilidade dos produtos.'
    });
  }
});

app.get('/api/pdv/stock/alerts', async (req, res) => {
  try {
    const productsRaw = await db.getCollection('products');
    let stockRaw = null;
    try {
      stockRaw = await db.getCollection('stock_ingredients');
    } catch (err) {
      stockRaw = null;
    }
    const payload = buildStockAlertsPayload(productsRaw, stockRaw);
    res.json({ ...payload, serverTime: nowISO() });
  } catch (err) {
    logApiError(req, 'api:pdv:stock:alerts', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar alertas de estoque.'
    });
  }
});

app.get('/api/pdv/health', async (req, res) => {
  try {
    const collections = db.listCollections();
    const dataDir = db.getDataDir();
    const [ordersRaw, customersRaw, productsRaw] = await Promise.all([
      db.getCollection('orders'),
      db.getCollection('customers'),
      db.getCollection('products')
    ]);

    const orders = Array.isArray(ordersRaw?.items)
      ? ordersRaw.items
      : Array.isArray(ordersRaw)
      ? ordersRaw
      : [];
    const customers = Array.isArray(customersRaw?.items)
      ? customersRaw.items
      : Array.isArray(customersRaw)
      ? customersRaw
      : [];
    const products = normalizeProductsList(productsRaw);

    let lastOrderAt = null;
    for (const order of orders) {
      const ts = resolveOrderTimestamp(order);
      if (!ts) continue;
      if (!lastOrderAt || ts > lastOrderAt) {
        lastOrderAt = ts;
      }
    }

    res.json({
      success: true,
      dataDir,
      collections,
      stats: {
        orders: {
          total: orders.length,
          lastUpdatedAt: lastOrderAt ? lastOrderAt.toISOString() : null
        },
        customers: { total: customers.length },
        products: { total: products.length }
      },
      sync: {
        enabled: Boolean(process.env.SYNC_BASE_URL),
        baseUrl: process.env.SYNC_BASE_URL || null
      },
      serverTime: nowISO()
    });
  } catch (err) {
    logApiError(req, 'api:pdv:health', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar status do PDV.'
    });
  }
});

app.get('/api/pdv/orders/metrics', async (req, res) => {
  try {
    const ordersRaw = await db.getCollection('orders');
    const orders = Array.isArray(ordersRaw?.items)
      ? ordersRaw.items
      : Array.isArray(ordersRaw)
      ? ordersRaw
      : [];
    const from = parseDateValue(req.query.from);
    const to = parseDateValue(req.query.to);

    const totals = {
      orders: 0,
      revenue: 0,
      averageTicket: 0
    };
    const statusBreakdown = {};
    const types = { delivery: 0, pickup: 0 };
    const deliveryFees = { total: 0 };

    for (const order of orders) {
      const ts = resolveOrderTimestamp(order);
      if (from && (!ts || ts < from)) continue;
      if (to && (!ts || ts > to)) continue;

      totals.orders += 1;
      const status = normalizeOrderStatus(order.status || order.orderStatus);
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

      const grandTotal = resolveOrderGrandTotal(order);
      totals.revenue += grandTotal;

      const isDelivery = isDeliveryOrder(order);
      if (isDelivery) {
        types.delivery += 1;
        deliveryFees.total += resolveOrderDeliveryFee(order);
      } else {
        types.pickup += 1;
      }
    }

    totals.averageTicket =
      totals.orders > 0 ? totals.revenue / totals.orders : 0;

    res.json({
      success: true,
      window: {
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null
      },
      totals,
      statuses: statusBreakdown,
      types,
      deliveryFees
    });
  } catch (err) {
    logApiError(req, 'api:pdv:orders:metrics', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao calcular metricas de pedidos.'
    });
  }
});

app.get('/api/pdv/customers/segments', async (req, res) => {
  try {
    const customersRaw = await db.getCollection('customers');
    const customers = Array.isArray(customersRaw?.items)
      ? customersRaw.items
      : Array.isArray(customersRaw)
      ? customersRaw
      : [];

    let vip = 0;
    let frequent = 0;
    let recent = 0;
    let inactive = 0;

    for (const customer of customers) {
      const totalOrders = customer.totalOrders || 0;
      const tags = Array.isArray(customer.tags) ? customer.tags : [];
      const isVipTag = tags.some(
        (tag) => String(tag).toLowerCase() === 'vip'
      );
      if (totalOrders >= 20 || isVipTag) {
        vip += 1;
      } else if (totalOrders >= 5) {
        frequent += 1;
      }

      if (totalOrders <= 2) {
        recent += 1;
      }

      const daysSinceLastOrder = diffInDaysFromToday(
        customer.meta?.lastOrderAt || customer.lastOrderAt
      );
      if (
        totalOrders === 0 ||
        daysSinceLastOrder === Infinity ||
        daysSinceLastOrder >= 180
      ) {
        inactive += 1;
      }
    }

    res.json({
      success: true,
      total: customers.length,
      segments: {
        vip,
        frequent,
        new: recent,
        inactive
      },
      rules: {
        vipMinOrders: 20,
        frequentMinOrders: 5,
        frequentMaxOrders: 19,
        newMaxOrders: 2,
        inactiveDays: 180
      }
    });
  } catch (err) {
    logApiError(req, 'api:pdv:customers:segments', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao calcular segmentos de clientes.'
    });
  }
});

app.get('/api/pdv/delivery/blocked-neighborhoods', async (req, res) => {
  try {
    const settingsRaw = await db.getCollection('settings');
    const settings = normalizePdvSettings(settingsRaw);
    const blocked = Array.isArray(settings.delivery?.blockedNeighborhoods)
      ? settings.delivery.blockedNeighborhoods.filter(Boolean)
      : [];

    const items = blocked.map((name) => ({
      name,
      key: normalizeNeighborhoodKey(name)
    }));
    const keys = Array.from(
      new Set(items.map((item) => item.key).filter(Boolean))
    );

    res.json({
      success: true,
      total: items.length,
      items,
      keys
    });
  } catch (err) {
    logApiError(req, 'api:pdv:delivery:blocked', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar bairros bloqueados.'
    });
  }
});

app.get('/api/pdv/printing/config', async (req, res) => {
  try {
    const settingsRaw = await db.getCollection('settings');
    const settings = normalizePdvSettings(settingsRaw);
    const printing = settings.printing || {};
    const kitchenPrinterName = printing.kitchenPrinterName || null;
    const counterPrinterName = printing.counterPrinterName || null;

    res.json({
      success: true,
      printing: {
        kitchenPrinterName,
        counterPrinterName,
        silentMode: printing.silentMode !== false,
        autoPrintWebsiteOrders: printing.autoPrintWebsiteOrders === true
      },
      hasPrinters: Boolean(kitchenPrinterName || counterPrinterName)
    });
  } catch (err) {
    logApiError(req, 'api:pdv:printing:config', err);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar configuracoes de impressao.'
    });
  }
});

app.get('/api/orders/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const typesParam = String(req.query.types || '').trim();
  const requestedTypes = typesParam
    ? typesParam.split(',').map((t) => t.trim()).filter(Boolean)
    : [];
  const allowedTypes = new Set(['created', 'updated']);
  const activeTypes = requestedTypes.length
    ? new Set(requestedTypes.filter((t) => allowedTypes.has(t)))
    : allowedTypes;

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('ready', {
    types: Array.from(activeTypes),
    serverTime: nowISO()
  });

  const onCreated = (order) => {
    if (activeTypes.has('created')) sendEvent('created', order);
  };
  const onUpdated = (order) => {
    if (activeTypes.has('updated')) sendEvent('updated', order);
  };

  orderEvents.on('created', onCreated);
  orderEvents.on('updated', onUpdated);

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    orderEvents.removeListener('created', onCreated);
    orderEvents.removeListener('updated', onUpdated);
  });
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
          logError('sync:collections', 'Erro ao sincronizar todas as cole��es', err);
    res.status(500).json({ error: 'Erro ao carregar cole��es.' });
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
          logError('sync:collection:get', 'Erro ao sincronizar cole��o (GET)', err);
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
      const synced =
        collection === 'settings'
          ? syncSettingsData(current, merged)
          : merged;
      await db.setCollection(collection, synced, { skipSync: true });
      return res.json({ success: true, mode: 'delta' });
    }

    if (payload.mode === 'full' && payload.data) {
      const current = await db.getCollection(collection);
      const synced =
        collection === 'settings'
          ? syncSettingsData(current, payload.data)
          : payload.data;
      await db.setCollection(collection, synced, { skipSync: true });
      return res.json({ success: true, mode: 'full' });
    }

    const current = await db.getCollection(collection);
    const synced =
      collection === 'settings'
        ? syncSettingsData(current, payload)
        : payload;
    await db.setCollection(collection, synced, { skipSync: true });
    return res.json({ success: true, mode: 'legacy' });
  } catch (err) {
          logError('sync:collection:post', 'Erro ao sincronizar cole��o (POST)', err);
    res.status(500).json({ error: 'Erro ao salvar colecao.' });
  }
});

// ============================================================================
// 3.1. ENDPOINT DE BUSCA DE CLIENTE POR TELEFONE
// ============================================================================
//
// Usado pelo CheckoutPage para ver se o cliente j� est� cadastrado.
// GET /api/customers/by-phone?phone=11999999999
//
app.get('/api/customers/by-phone', async (req, res) => {
  try {
    const rawPhone = req.query.phone || '';
    const digits = rawPhone.replace(/\D/g, '');

    if (!digits || digits.length < 8) {
      return res
        .status(400)
        .json({ error: 'Par�metro "phone" inv�lido ou muito curto.' });
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
      return res.status(404).json({ error: 'Cliente n�o encontrado.' });
    }

    // Retorna o registro completo do cliente
    return res.json(found);
  } catch (err) {
          logApiError(req, 'api:customers/by-phone', err);
    res.status(500).json({ error: 'Erro ao buscar cliente por telefone.' });
  }
});

// ============================================================================
// 3.2. VALIDA��O E CADASTRO DE NOVOS CLIENTES (POST /api/customers)
// ============================================================================

function validateCustomerPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return ['Payload inv�lido.'];
  }

  if (
    !payload.name ||
    typeof payload.name !== 'string' ||
    payload.name.trim().length < 2
  ) {
    errors.push('Nome � obrigat�rio e deve ter pelo menos 2 caracteres.');
  }

  if (!payload.phone || typeof payload.phone !== 'string') {
    errors.push('Telefone � obrigat�rio.');
  } else {
    const digits = payload.phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      errors.push('Telefone deve ter 10 ou 11 d�gitos (com DDD).');
    }
  }

  const addr = payload.address;
  if (!addr || typeof addr !== 'object') {
    errors.push('Endere�o � obrigat�rio.');
  } else {
    if (!addr.cep) errors.push('CEP � obrigat�rio.');
    if (!addr.street) errors.push('Rua � obrigat�ria.');
    if (!addr.number) errors.push('N�mero � obrigat�rio.');
    if (!addr.neighborhood) errors.push('Bairro � obrigat�rio.');
    if (!addr.city) errors.push('Cidade � obrigat�ria.');
    if (!addr.state) errors.push('Estado � obrigat�rio.');
  }

  return errors;
}

// POST espec�fico para clientes, com valida��o e checagem de duplicidade
app.post('/api/customers', async (req, res) => {
  try {
    const payload = req.body || {};

    // 1) Valida��o b�sica
    const errors = validateCustomerPayload(payload);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Dados de cliente inv�lidos.',
        errors
      });
    }

    // 2) Normalizar telefone e checar se j� existe
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
        message: 'J� existe um cliente cadastrado com esse telefone.',
        customer: existing
      });
    }

    // 3) Montar objeto do cliente
    const now = new Date().toISOString();

    const newCustomer = {
      // id ser� preenchido automaticamente pelo db.addItem se n�o informarmos
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
// 3.3. ATUALIZA��O DE STATUS DO MOTOBOY
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
        message: 'Status inv�lido. Use: available, delivering ou offline.'
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
        message: 'Motoboy n�o encontrado.'
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
        message: 'Motoboy n�o encontrado.'
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
// Retorna um JSON simples com status do pedido e dados b�sicos do motoboy.
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
        message: 'Pedido n�o encontrado.'
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
// 3.6. V�NCULO DE MOTOBOY AO PEDIDO VIA QR TOKEN (SCAN)
// ============================================================================
//
// POST /motoboy/pedido/:orderId/link
//
// Body esperado:
// {
//   "qrToken": "qr-123..."   // token �nico do motoboy
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
        message: 'qrToken � obrigat�rio no corpo da requisi��o.'
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
        message: 'Motoboy n�o encontrado para este qrToken.'
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
        message: 'Pedido n�o encontrado.'
      });
    }

    const order = orders[orderIndex];
    const normalizedStatus = (order.status || '').toString().toLowerCase();
    const lockedStatuses = new Set(['out_for_delivery', 'done', 'cancelled']);
    if (lockedStatuses.has(normalizedStatus)) {
      const detail = `Pedido ${orderId} com status ${order.status} n�o pode ser aceito novamente (qrToken ${qrToken}).`;
      console.warn('[apiServer][motoboy/link] ' + detail);
      return res.status(409).json({
        success: false,
        message: 'Pedido j� est� em rota ou encerrado.',
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
// ============================================================================
// 3.X. AXIONPAY PIX (PROXY)
// ============================================================================
//
// POST /api/axionpay/pix
// Body esperado (exemplo):
// {
//   "amount": 63.50,
//   "amount_cents": 6350,
//   "currency": "BRL",
//   "customer": { ... },
//   "metadata": { ... }
// }
//
// Retorna um unico payload BR Code.
//
async function requestAxionPayPix(payload, requestId) {
  if (!AXIONPAY_BASE_URL) {
    throw new Error('AXIONPAY_BASE_URL nao configurado.');
  }

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  if (AXIONPAY_API_KEY) {
    headers['x-api-key'] = AXIONPAY_API_KEY;
  }

  if (requestId) {
    headers['x-request-id'] = requestId;
  }

  const response = await fetchFn(`${AXIONPAY_BASE_URL}/payments/pix`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (data && (data.error || data.message)) ||
      `AXIONPAY respondeu ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = data;
    throw err;
  }

  const pixPayload =
    data?.pix_payload ||
    data?.transaction?.metadata?.pix?.copia_colar ||
    data?.transaction?.metadata?.pix?.qrcode ||
    data?.transaction?.metadata?.pix?.payload ||
    '';

  if (!pixPayload) {
    throw new Error('AXIONPAY nao retornou payload PIX.');
  }

  return { pixPayload, raw: data };
}

app.post('/api/axionpay/pix', async (req, res) => {
  try {
    const body = req.body || {};
    const payload = {
      amount: body.amount,
      amount_cents: body.amount_cents,
      currency: body.currency,
      customer: body.customer,
      metadata: body.metadata
    };

    const result = await requestAxionPayPix(payload, req.id);
    return res.json({
      success: true,
      payload: result.pixPayload
    });
  } catch (err) {
    logApiError(req, 'api:axionpay:pix', err, {
      baseUrl: AXIONPAY_BASE_URL
    });
    return res.status(502).json({
      success: false,
      message: err.message || 'Falha ao gerar PIX via AXIONPAY.'
    });
  }
});
// 4. ENDPOINTS GEN�RICOS EXISTENTES (mantidos)
// ============================================================================

// Healthcheck simples
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    dataDir: db.getDataDir(),
    collections: db.listCollections()
  });
});

// Listar cole��o: GET /api/orders, /api/customers, etc.
app.get('/api/:collection', async (req, res) => {
  const { collection } = req.params;
  try {
    const data = await db.getCollection(collection);
    res.json(data);
  } catch (err) {
          logApiError(req, 'api:getCollection', err);
    res
      .status(400)
      .json({ error: err.message || 'Erro ao carregar cole��o' });
  }
});

// Criar item gen�rico: POST /api/orders, /api/qualquer-coisa
// (clientes usam o POST espec�fico acima: /api/customers)
app.post('/api/:collection', async (req, res) => {
  const { collection } = req.params;
  const payload = req.body;
  let payloadToSave = payload;

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
          message: `N�o entregamos no bairro "${blockedMatch}".`,
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

    if (collection === 'settings') {
      const current = await db.getCollection('settings');
      payloadToSave = syncSettingsData(current, payloadToSave);
    }

    const created = await db.addItem(collection, payloadToSave);
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
  let changesToSave = changes;

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
          message: `N�o entregamos no bairro "${blockedMatch}".`,
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

    if (collection === 'settings') {
      const current = await db.getCollection('settings');
      const items = Array.isArray(current?.items)
        ? current.items
        : Array.isArray(current)
        ? current
        : [];
      const existing = items.find((item) => String(item.id) === String(id)) || null;
      const merged = {
        ...(existing || {}),
        ...(changesToSave || {})
      };
      if (existing?.businessHours || changesToSave?.businessHours) {
        const mergedHours = {
          ...(existing?.businessHours || {}),
          ...(changesToSave?.businessHours || {})
        };
        merged.businessHours = syncBusinessHoursTimes(
          existing ? existing.businessHours : null,
          mergedHours
        );
      }
      changesToSave = merged;
    }

    const updated = await db.updateItem(collection, id, changesToSave);
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

// Resetar cole��o: POST /api/orders/reset
app.post('/api/:collection/reset', async (req, res) => {
  const { collection } = req.params;

  try {
    const result = await db.resetCollection(collection);
    res.json(result);
  } catch (err) {
          logApiError(req, 'api:resetCollection', err);
    res
      .status(400)
      .json({ error: err.message || 'Erro ao resetar cole��o' });
  }
});

// ============================================================================
// 5. IN�CIO DO SERVIDOR
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

