const ensureDataEngine = () => {
  if (
    !globalThis.window.dataEngine ||
    typeof globalThis.window.dataEngine.get !== "function"
  ) {
    throw new Error("window.dataEngine não está disponível no momento.");
  }
  return globalThis.window.dataEngine;
};

const normalizeAmount = (value) => {
  const normalized = Number(String(value || "").replace(",", "."));
  return Number.isNaN(normalized) ? 0 : normalized;
};

const createId = (prefix) => {
  const random = Math.random().toString(16).slice(2);
  return `${prefix}-${Date.now()}-${random}`;
};

const buildQrToken = () => {
  const crypto = globalThis.crypto || globalThis.msCrypto;
  if (crypto && typeof crypto.randomUUID === "function") {
    return `motoboy-qr-${crypto.randomUUID()}`;
  }
  return createId("motoboy-qr");
};

export async function getMotoboys() {
  const dataEngine = ensureDataEngine();
  const payload = await dataEngine.get("motoboys");
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items;
}

export async function saveMotoboy(motoboy) {
  if (!motoboy || typeof motoboy !== "object") {
    throw new Error("Motoboy inválido para salvar.");
  }
  const dataEngine = ensureDataEngine();
  const now = new Date().toISOString();
  const normalized = {
    ...motoboy,
    active: motoboy.active ?? true,
    status: motoboy.status || "available",
    updatedAt: now,
  };

  if (!normalized.id) {
    normalized.createdAt = now;
    return dataEngine.addItem("motoboys", normalized);
  }

  const { id, ...changes } = normalized;
  return dataEngine.updateItem("motoboys", id, changes);
}

export async function toggleMotoboyActive(motoboyId, nextActive) {
  if (!motoboyId) {
    throw new Error("ID do motoboy obrigatório.");
  }
  const dataEngine = ensureDataEngine();
  const now = new Date().toISOString();
  return dataEngine.updateItem("motoboys", motoboyId, {
    active: Boolean(nextActive),
    updatedAt: now,
  });
}

export async function generateMotoboyQr(motoboy) {
  if (!motoboy.id) {
    throw new Error("Motoboy inválido para gerar QR.");
  }
  const dataEngine = ensureDataEngine();
  const now = new Date().toISOString();
  const qrToken = buildQrToken();
  await dataEngine.updateItem("motoboys", motoboy.id, {
    qrToken,
    updatedAt: now,
  });
  return qrToken;
}

export async function addMotoboyTip(motoboy, tipDraft) {
  if (!motoboy.id) {
    throw new Error("Motoboy inválido para registrar gorjeta.");
  }
  if (!tipDraft || typeof tipDraft !== "object") {
    throw new Error("Dados da gorjeta não informados.");
  }

  const dataEngine = ensureDataEngine();
  const now = new Date().toISOString();
  const payload = await dataEngine.get("motoboys");
  const items = Array.isArray(payload.items) ? payload.items : [];
  const existing = items.find((entry) => String(entry.id) === String(motoboy.id));
  if (!existing) {
    throw new Error("Motoboy não encontrado.");
  }

  const amount = normalizeAmount(tipDraft.amount);
  if (amount <= 0) {
    throw new Error("Valor da gorjeta deve ser maior que zero.");
  }

  const tip = {
    id: tipDraft.id || createId("tip"),
    amount,
    note: (tipDraft.note || "").trim(),
    at: tipDraft.at || now,
    createdAt: now,
  };

  const nextTips = [
    tip,
    ...(Array.isArray(existing.tips) ? existing.tips : []),
  ];
  const nextTotal = nextTips.reduce(
    (sum, entry) => sum + (Number(entry.amount) || 0),
    0
  );

  await dataEngine.updateItem("motoboys", existing.id, {
    tips: nextTips,
    tipsTotal: nextTotal,
    updatedAt: now,
  });
  return tip;
}
