// src/renderer/pages/Deliveries.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import '../styles/global.scss';
import '../styles/deliveries.scss';

import { formatCurrency } from './Orders'; // ajuste o caminho se necessário

// -----------------------------
// Helpers de data / período
// -----------------------------
function normalizeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function toInputDate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isToday(isoOrDate) {
  const d = normalizeDate(isoOrDate);
  if (!d) return false;
  return startOfDay(d).getTime() === startOfDay(new Date()).getTime();
}

function isInLastDays(isoOrDate, days) {
  const d = normalizeDate(isoOrDate);
  if (!d) return false;
  const today = startOfDay(new Date());
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  const dd = startOfDay(d);
  return dd >= start && dd <= today;
}

// -----------------------------
// Página de Entregas / Motoboys
// -----------------------------
export default function DeliveriesPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [period, setPeriod] = useState('today'); // today | 7d | 30d | all
  const [statusFilter, setStatusFilter] = useState('in_progress'); // pending | in_progress | delivered | problem | all

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // lista simples de motoboys (apenas para facilitar seleção)
  const [driverInput, setDriverInput] = useState('');
  const [knownDrivers, setKnownDrivers] = useState([]);
  const hasLoadedRef = useRef(false);

  // carrega pedidos do DB
  const loadOrders = useCallback(async () => {
    const initialLoad = !hasLoadedRef.current;
    try {
      if (initialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      if (!window.db.orders.getAll) {
        console.warn('window.db.orders.getAll nao esta disponivel.');
        return;
      }

      const list = await window.db.orders.getAll();
      const arr = Array.isArray(list)  list : [];

      // ordena do mais novo para o mais antigo
      arr.sort((a, b) => {
        const aDate = a.createdAtISO || a.createdAt;
        const bDate = b.createdAtISO || b.createdAt;
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return new Date(bDate) - new Date(aDate);
      });

      setOrders(arr);
      hasLoadedRef.current = true;

      // popula lista de motoboys existentes nos pedidos
      const drivers = new Set();
      arr.forEach((o) => {
        if (o.driverName) {
          drivers.add(String(o.driverName).trim());
        }
      });
      setKnownDrivers(Array.from(drivers));
    } catch (err) {
      console.error('Erro ao carregar pedidos para Entregas:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // inicializa datas com hoje
  useEffect(() => {
    const today = new Date();
    const iso = toInputDate(today);
    setDateFrom(iso);
    setDateTo(iso);
  }, []);

  // atualiza datas quando muda o período rápido
  useEffect(() => {
    const today = new Date();
    if (period === 'today') {
      const iso = toInputDate(today);
      setDateFrom(iso);
      setDateTo(iso);
    } else if (period === '7d') {
      const end = today;
      const start = new Date();
      start.setDate(start.getDate() - 6);
      setDateFrom(toInputDate(start));
      setDateTo(toInputDate(end));
    } else if (period === '30d') {
      const end = today;
      const start = new Date();
      start.setDate(start.getDate() - 29);
      setDateFrom(toInputDate(start));
      setDateTo(toInputDate(end));
    }
    // "all" mantém datas escolhidas manualmente, se quiser
  }, [period]);

  // apenas entregas (retirada = false)
  const deliveryOrders = useMemo(() => {
    return orders.filter((o) => !o.retirada);
  }, [orders]);

  // aplica filtro de datas e status
  const filteredDeliveries = useMemo(() => {
    if (!deliveryOrders.length) return [];

    let fromDate = null;
    let toDate = null;

    if (dateFrom) {
      fromDate = startOfDay(new Date(dateFrom));
    }
    if (dateTo) {
      toDate = endOfDay(new Date(dateTo));
    }

    return deliveryOrders.filter((o) => {
      const d = normalizeDate(o.createdAtISO || o.createdAt);
      if (!d) return false;

      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;

      // filtro por período rápido (opcional, baseado em createdAtISO)
      if (period === 'today' && !isToday(d)) return false;
      if (period === '7d' && !isInLastDays(d, 7)) return false;
      if (period === '30d' && !isInLastDays(d, 30)) return false;

      const status = (o.deliveryStatus || 'pending').toLowerCase();
      if (statusFilter === 'all') return true;
      if (statusFilter === 'pending') return status === 'pending';
      if (statusFilter === 'in_progress')
        return status === 'out_for_delivery';
      if (statusFilter === 'delivered') return status === 'delivered';
      if (statusFilter === 'problem') return status === 'problem';
      return true;
    });
  }, [deliveryOrders, period, dateFrom, dateTo, statusFilter]);

  const hasData = filteredDeliveries.length > 0;
  const isInitialLoading = loading && !hasLoadedRef.current;

  // helper pra salvar array de pedidos
  const persistOrders = useCallback(
    (updater) => {
      setOrders((prev) => {
        const next = typeof updater === 'function'  updater(prev) : updater;
        const list = Array.isArray(next)  next : [];

        if (window.db.orders.saveAll) {
          window.db.orders.saveAll(list).catch((err) => {
            console.error('Erro ao salvar orders.json (Entregas):', err);
          });
        }

        // também atualiza lista de motoboys
        const drivers = new Set();
        list.forEach((o) => {
          if (o.driverName) {
            drivers.add(String(o.driverName).trim());
          }
        });
        setKnownDrivers(Array.from(drivers));

        return list;
      });
    },
    []
  );

  // métricas
  const metrics = useMemo(() => {
    if (!hasData) {
      return {
        totalDeliveries: 0,
        inProgress: 0,
        delivered: 0,
        pending: 0,
        problems: 0,
        totalFees: 0,
        avgFee: 0,
        avgTimeMinutes: 0
      };
    }

    let total = 0;
    let inProgress = 0;
    let delivered = 0;
    let pending = 0;
    let problems = 0;
    let fees = 0;

    let timeSumMinutes = 0;
    let timeCount = 0;

    filteredDeliveries.forEach((o) => {
      total += 1;

      const status = (o.deliveryStatus || 'pending').toLowerCase();
      if (status === 'pending') pending += 1;
      else if (status === 'out_for_delivery') inProgress += 1;
      else if (status === 'delivered') delivered += 1;
      else if (status === 'problem') problems += 1;

      const fee = Number(o.deliveryFee || 0);
      fees += fee;

      const outAt = normalizeDate(o.outForDeliveryAt);
      const deliveredAt = normalizeDate(o.deliveredAt);
      if (outAt && deliveredAt && deliveredAt >= outAt) {
        const diffMs = deliveredAt - outAt;
        const diffMin = diffMs / 1000 / 60;
        timeSumMinutes += diffMin;
        timeCount += 1;
      }
    });

    const avgFee = total > 0  fees / total : 0;
    const avgTimeMinutes = timeCount > 0  timeSumMinutes / timeCount : 0;

    return {
      totalDeliveries: total,
      inProgress,
      delivered,
      pending,
      problems,
      totalFees: fees,
      avgFee,
      avgTimeMinutes
    };
  }, [filteredDeliveries, hasData]);

  // mudar status de entrega
  const updateDeliveryStatus = useCallback(
    (orderId, newStatus) => {
      persistOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;

          const nowIso = new Date().toISOString();
          let patch = { deliveryStatus: newStatus };

          if (newStatus === 'out_for_delivery' && !o.outForDeliveryAt) {
            patch.outForDeliveryAt = nowIso;
          }

          if (newStatus === 'delivered') {
            patch.deliveredAt = nowIso;
            if (!o.outForDeliveryAt) {
              patch.outForDeliveryAt = nowIso;
            }
          }

          return { ...o, ...patch };
        })
      );
    },
    [persistOrders]
  );

  // atribuir motoboy
  const updateDriver = useCallback(
    (orderId, driverName) => {
      const name = (driverName || '').trim();
      persistOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
             {
                ...o,
                driverName: name || null
              }
            : o
        )
      );
    },
    [persistOrders]
  );

  // adicionar um nome de motoboy à lista rápida
  const handleAddDriver = useCallback(() => {
    const name = driverInput.trim();
    if (!name) return;
    setKnownDrivers((prev) =>
      prev.includes(name)  prev : [...prev, name]
    );
    setDriverInput('');
  }, [driverInput]);

  // UI helpers
  const statusLabel = (statusRaw) => {
    const status = (statusRaw || 'pending').toLowerCase();
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'out_for_delivery':
        return 'Em rota';
      case 'delivered':
        return 'Entregue';
      case 'problem':
        return 'Problema';
      default:
        return status;
    }
  };

  const statusClass = (statusRaw) => {
    const status = (statusRaw || 'pending').toLowerCase();
    if (status === 'out_for_delivery') return 'delivery-status-pill in-progress';
    if (status === 'delivered') return 'delivery-status-pill delivered';
    if (status === 'problem') return 'delivery-status-pill problem';
    return 'delivery-status-pill pending';
  };

  const periodLabel = () => {
    switch (period) {
      case 'today':
        return 'Hoje';
      case '7d':
        return 'Últimos 7 dias';
      case '30d':
        return 'Últimos 30 dias';
      case 'all':
      default:
        return 'Todo o período';
    }
  };

  const handleResetFilters = () => {
    setPeriod('today');
    setStatusFilter('in_progress');
  };

  // render
  return (
    <div className="page-deliveries">
      <div className="deliveries-header">
        <div>
          <h1 className="deliveries-title">Entregas / Motoboys</h1>
          <p className="deliveries-subtitle">
            Acompanhe pedidos em entrega, motoboys e tempos de entrega.
          </p>
        </div>

        <div className="deliveries-header-right">
          <div className="deliveries-period-group">
            <span className="deliveries-label">Período</span>
            <div className="deliveries-pill-group">
              <button
                type="button"
                className={
                  'deliveries-pill' +
                  (period === 'today'  ' deliveries-pill-active' : '')
                }
                onClick={() => setPeriod('today')}
              >
                Hoje
              </button>
              <button
                type="button"
                className={
                  'deliveries-pill' +
                  (period === '7d'  ' deliveries-pill-active' : '')
                }
                onClick={() => setPeriod('7d')}
              >
                Últimos 7 dias
              </button>
              <button
                type="button"
                className={
                  'deliveries-pill' +
                  (period === '30d'  ' deliveries-pill-active' : '')
                }
                onClick={() => setPeriod('30d')}
              >
                Últimos 30 dias
              </button>
              <button
                type="button"
                className={
                  'deliveries-pill' +
                  (period === 'all'  ' deliveries-pill-active' : '')
                }
                onClick={() => setPeriod('all')}
              >
                Todo o período
              </button>
            </div>
          </div>

          <div className="deliveries-dates">
            <div className="deliveries-date-field">
              <label>De</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="deliveries-date-field">
              <label>Até</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-small"
            onClick={loadOrders}
            disabled={loading || isRefreshing}
          >
            {loading || isRefreshing  'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* linha status filter + motoboys rápidos */}
      <div className="deliveries-toolbar">
        <div className="deliveries-status-filter">
          <span className="deliveries-label">Status</span>
          <div className="deliveries-status-chips">
            <button
              type="button"
              className={
                'status-chip' +
                (statusFilter === 'in_progress'  ' active' : '')
              }
              onClick={() => setStatusFilter('in_progress')}
            >
              Em rota
            </button>
            <button
              type="button"
              className={
                'status-chip' +
                (statusFilter === 'pending'  ' active' : '')
              }
              onClick={() => setStatusFilter('pending')}
            >
              Pendentes
            </button>
            <button
              type="button"
              className={
                'status-chip' +
                (statusFilter === 'delivered'  ' active' : '')
              }
              onClick={() => setStatusFilter('delivered')}
            >
              Entregues
            </button>
            <button
              type="button"
              className={
                'status-chip' +
                (statusFilter === 'problem'  ' active' : '')
              }
              onClick={() => setStatusFilter('problem')}
            >
              Problema
            </button>
            <button
              type="button"
              className={
                'status-chip' +
                (statusFilter === 'all'  ' active' : '')
              }
              onClick={() => setStatusFilter('all')}
            >
              Todos
            </button>
          </div>
        </div>

        <div className="deliveries-drivers-box">
          <span className="deliveries-label">Motoboys rápidos</span>
          <div className="deliveries-drivers-input">
            <input
              type="text"
              placeholder="Adicionar motoboy..."
              value={driverInput}
              onChange={(e) => setDriverInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddDriver();
                }
              }}
            />
            <button
              type="button"
              className="btn btn-outline btn-small"
              onClick={handleAddDriver}
            >
              Adicionar
            </button>
          </div>
          {knownDrivers.length > 0 && (
            <div className="deliveries-drivers-list">
              {knownDrivers.map((d) => (
                <span key={d} className="driver-pill">
                  {d}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {isRefreshing && (
        <div className="order-list-refresh">Atualizando entregas...</div>
      )}

      {isInitialLoading && (
        <>
          <div className="deliveries-summary-grid">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div
                key={`deliveries-summary-skeleton-${idx}`}
                className="skeleton skeleton-card"
              />
            ))}
          </div>
          <div className="deliveries-panel">
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        </>
      )}

      {!loading && !hasData && (
        <div className="empty-state">
          <div className="empty-title">Nenhuma entrega encontrada</div>
          <div className="empty-description">
            Nenhuma entrega para {periodLabel()}. Ajuste os filtros ou
            confirme se ha pedidos com entrega cadastrados.
          </div>
          <div className="empty-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleResetFilters}
            >
              Limpar filtros
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={loadOrders}
            >
              Recarregar
            </button>
          </div>
        </div>
      )}

      {!isInitialLoading && hasData && (
        <>
          {/* cards resumo */}
          <div className="deliveries-summary-grid">
            <div className="deliveries-card">
              <div className="deliveries-card-label">
                Entregas no período
              </div>
              <div className="deliveries-card-value">
                {metrics.totalDeliveries}
              </div>
              <div className="deliveries-card-helper">
                Considerando apenas pedidos com entrega.
              </div>
            </div>

            <div className="deliveries-card">
              <div className="deliveries-card-label">Em rota agora</div>
              <div className="deliveries-card-value">
                {metrics.inProgress}
              </div>
              <div className="deliveries-card-helper">
                Pedidos com status "Em rota".
              </div>
            </div>

            <div className="deliveries-card">
              <div className="deliveries-card-label">Entregues</div>
              <div className="deliveries-card-value">
                {metrics.delivered}
              </div>
              <div className="deliveries-card-helper">
                No período selecionado.
              </div>
            </div>

            <div className="deliveries-card">
              <div className="deliveries-card-label">Taxas de entrega</div>
              <div className="deliveries-card-value">
                {formatCurrency(metrics.totalFees)}
              </div>
              <div className="deliveries-card-helper">
                Soma das taxas de entrega dos pedidos.
              </div>
            </div>

            <div className="deliveries-card">
              <div className="deliveries-card-label">
                Taxa média por entrega
              </div>
              <div className="deliveries-card-value">
                {formatCurrency(metrics.avgFee)}
              </div>
              <div className="deliveries-card-helper">
                Valor médio cobrado de entrega.
              </div>
            </div>

            <div className="deliveries-card">
              <div className="deliveries-card-label">
                Tempo médio de entrega
              </div>
              <div className="deliveries-card-value">
                {metrics.avgTimeMinutes > 0
                   `${metrics.avgTimeMinutes.toFixed(1)} min`
                  : '--'}
              </div>
              <div className="deliveries-card-helper">
                Entre saída para entrega e confirmação de entrega.
              </div>
            </div>
          </div>

          {/* Tabela de entregas */}
          <div className="deliveries-panel">
            <div className="deliveries-panel-header">
              <div>
                <div className="deliveries-panel-title">
                  Entregas de {periodLabel()}
                </div>
                <div className="deliveries-panel-subtitle">
                  Últimos pedidos com entrega. Atualize o motoboy e o
                  status conforme o andamento.
                </div>
              </div>
            </div>

            <div className="deliveries-table-wrapper">
              <table className="deliveries-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Data/Hora</th>
                    <th>Cliente</th>
                    <th>Bairro</th>
                    <th>Motoboy</th>
                    <th>Status</th>
                    <th className="text-right">Entrega</th>
                    <th className="text-right">Total</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeliveries.map((o) => {
                    const dRaw = o.createdAtISO || o.createdAt;
                    const d = normalizeDate(dRaw);
                    const dtText = d
                       d.toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        })
                      : '';

                    const addr =
                      o.customerAddress ||
                      o.address ||
                      (o.customer && o.customer.address) ||
                      {};
                    const neighborhood =
                      addr.neighborhood || addr.bairro || '';

                    return (
                      <tr key={o.id  dRaw}>
                        <td>{o.id}</td>
                        <td>{dtText}</td>
                        <td>{o.customerName || 'Cliente'}</td>
                        <td>{neighborhood}</td>
                        <td>
                          <div className="delivery-driver-cell">
                            <select
                              value={o.driverName || ''}
                              onChange={(e) =>
                                updateDriver(o.id, e.target.value)
                              }
                            >
                              <option value="">(sem motoboy)</option>
                              {knownDrivers.map((dname) => (
                                <option key={dname} value={dname}>
                                  {dname}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td>
                          <span className={statusClass(o.deliveryStatus)}>
                            {statusLabel(o.deliveryStatus)}
                          </span>
                        </td>
                        <td className="text-right">
                          {formatCurrency(o.deliveryFee || 0)}
                        </td>
                        <td className="text-right">
                          {formatCurrency(o.total || 0)}
                        </td>
                        <td>
                          <div className="delivery-actions">
                            <button
                              type="button"
                              className="btn-chip"
                              onClick={() =>
                                updateDeliveryStatus(
                                  o.id,
                                  'out_for_delivery'
                                )
                              }
                            >
                              Em rota
                            </button>
                            <button
                              type="button"
                              className="btn-chip success"
                              onClick={() =>
                                updateDeliveryStatus(o.id, 'delivered')
                              }
                            >
                              Entregue
                            </button>
                            <button
                              type="button"
                              className="btn-chip danger"
                              onClick={() =>
                                updateDeliveryStatus(o.id, 'problem')
                              }
                            >
                              Problema
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
