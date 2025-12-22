
// electron/apiServer.js
// Servidor HTTP/REST para expor o DataEngine via HTTP (site, app, integrações)

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// Agora que DATA_DIR est  definido (se existir), podemos carregar o db.js
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3030;
const PUBLIC_API_TOKEN = process.env.PUBLIC_API_TOKEN || '';
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 120);
const rateStore = new Map();

// URL base para tracking do pedido do motoboy (via QR / link)
// Pode ser sobrescrita com ANNETOM_TRACKING_BASE_URL em produção.
const DEFAULT_TRACKING_BASE_URL =
  process.env.ANNETOM_TRACKING_BASE_URL ||
  "http://localhost:3030/motoboy/pedido/";

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
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.options('*', cors());

function rateLimiter(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.connection?.remoteAddress || 'unknown';
  const entry = rateStore.get(key);
  if (!entry || entry.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    res.setHeader('X-RateLimit-Remaining', RATE_LIMIT_MAX - 1);
    return next();
  }

  entry.count += 1;
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX - entry.count));
  if (entry.count > RATE_LIMIT_MAX) {
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

  const token = req.headers['x-api-key'] || req.query.api_key;
  if (token !== PUBLIC_API_TOKEN) {
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
    console.error('[api:menu] Erro ao carregar cardápio:', err);
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
    console.error('[sync:collections] Error:', err);
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
    console.error('[sync:collection:get] Error:', err);
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
    console.error('[sync:collection:post] Error:', err);
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
    console.error('[api:customers/by-phone] Error:', err);
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
    console.error('[api:customers:post] Error:', err);
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
    console.error('[api:motoboys/status] Error:', err);
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
    console.error('[api:motoboys/getStatus] Error:', err);
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

    // 3) Resposta enxuta pro app / QR
    return res.json({
      success: true,
      orderId: order.id || orderId,
      status: order.status || 'open',
      source: order.source || 'unknown',
      motoboy: motoboyInfo,
      // opcional: pedido completo pra app mobile usar
      order
    });
  } catch (err) {
    console.error('[api:motoboy/pedido] Error:', err);
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

    // 1) Carrega motoboys e encontra pelo qrToken
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

    // 2) Carrega pedidos e encontra o pedido
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

    const now = new Date().toISOString();

    // 3) Atualiza o pedido com dados do motoboy + status
    const updatedOrder = {
      ...order,
      status: 'out_for_delivery', // "Em entrega" no painel
      motoboyId: motoboy.id,
      motoboyName: motoboy.name,
      motoboyPhone: motoboy.phone,
      motoboyBaseNeighborhood: motoboy.baseNeighborhood || null,
      motoboyBaseFee: motoboy.baseFee ?? null,
      motoboySnapshot: {
        id: motoboy.id,
        name: motoboy.name,
        phone: motoboy.phone,
        baseNeighborhood: motoboy.baseNeighborhood || null,
        baseFee: motoboy.baseFee ?? null
      },
      motoboyStatus: 'out_for_delivery',
      delivery: {
        ...(order.delivery || {}),
        motoboyId: motoboy.id,
        motoboyName: motoboy.name,
        motoboyPhone: motoboy.phone,
        motoboyBaseNeighborhood: motoboy.baseNeighborhood || null,
        motoboyBaseFee: motoboy.baseFee ?? null,
        motoboySnapshot: {
          id: motoboy.id,
          name: motoboy.name,
          phone: motoboy.phone,
          baseNeighborhood: motoboy.baseNeighborhood || null,
          baseFee: motoboy.baseFee ?? null
        },
        motoboyStatus: 'out_for_delivery'
      },
      updatedAt: now
    };

    // 4) Persiste o pedido atualizado
    const savedOrder = await db.updateItem(
      'orders',
      order.id || orderId,
      updatedOrder
    );

    // 5) Atualiza status do motoboy para "delivering"
    await db.updateItem('motoboys', motoboy.id, {
      status: 'delivering',
      updatedAt: now
    });

    return res.json({
      success: true,
      message: 'Motoboy vinculado ao pedido com sucesso.',
      order: savedOrder,
      motoboy: {
        id: motoboy.id,
        name: motoboy.name,
        phone: motoboy.phone,
        status: 'delivering'
      }
    });
  } catch (err) {
    console.error('[api:motoboy/link] Error:', err);
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
    console.error('[api:getCollection] Error:', err);
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
    const created = await db.addItem(collection, payload);
    res.status(201).json(created);
  } catch (err) {
    console.error('[api:addItem] Error:', err);
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
    const updated = await db.updateItem(collection, id, changes);
    res.json(updated);
  } catch (err) {
    console.error('[api:updateItem] Error:', err);
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
    console.error('[api:removeItem] Error:', err);
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
    console.error('[api:resetCollection] Error:', err);
    res
      .status(400)
      .json({ error: err.message || 'Erro ao resetar coleção' });
  }
});

// ============================================================================
// 5. INÍCIO DO SERVIDOR
// ============================================================================
app.listen(PORT, () => {
  console.log(`[apiServer] Listening on port ${PORT}`);
  console.log('[apiServer] DATA_DIR (db.js):', db.getDataDir());
  console.log('[apiServer] Collections:', db.listCollections());
});

module.exports = app;









