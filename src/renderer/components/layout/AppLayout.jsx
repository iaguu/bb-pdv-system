import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/orders", label: "Pedidos" },
  { to: "/catalog", label: "Catalogo" },
  { to: "/people", label: "Pessoas" },
  { to: "/estoque", label: "Estoque" },
  { to: "/finance", label: "Caixa & Financeiro" },
  { to: "/settings", label: "Configuracoes" },
];

const AppLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [syncAlert, setSyncAlert] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncNowPending, setSyncNowPending] = useState(false);
  const [syncNowError, setSyncNowError] = useState("");
  const [appToasts, setAppToasts] = useState([]);
  const lastSeenRef = useRef(
    typeof window !== "undefined"
       window.localStorage.getItem("bb-pdv:lastSeenOrdersAt")
      : null
  );
  const lastProcessedRef = useRef(null);
  const toastTimerRef = useRef(null);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef(new Map());

  useEffect(() => {
    const dispatchShortcut = (action) => {
      window.dispatchEvent(
        new CustomEvent("app:shortcut", { detail: { action } })
      );
    };

    const handleKey = (event) => {
      const target = event.target;
      const tag = target.tagName;
      const isField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target.isContentEditable;

      const key = (event.key || "").toLowerCase();
      const isCtrl = event.ctrlKey || event.metaKey;
      const isAlt = event.altKey;

      if (isAlt && !event.shiftKey && !isCtrl) {
        const pageMap = {
          1: "/dashboard",
          2: "/orders",
          3: "/catalog",
          4: "/people",
          5: "/estoque",
          6: "/finance",
          7: "/settings",
        };
        const route = pageMap[key];
        if (route) {
          event.preventDefault();
          navigate(route);
        }
        return;
      }

      if (isCtrl && key === "n") {
        event.preventDefault();
        dispatchShortcut("new-order");
        return;
      }

      if (isCtrl && key === "i") {
        event.preventDefault();
        dispatchShortcut("open-item-picker");
        return;
      }

      if (isCtrl && key === "s") {
        event.preventDefault();
        dispatchShortcut("save-order");
        return;
      }

      if (isCtrl && event.shiftKey && key === "p") {
        event.preventDefault();
        dispatchShortcut("print-order");
        return;
      }

      if (isCtrl && key === "f") {
        if (location.pathname === "/orders") {
          event.preventDefault();
          dispatchShortcut("focus-order-search");
        }
        return;
      }

      if ((event.key === "F5" || (isCtrl && key === "r")) && !isField) {
        if (location.pathname === "/orders") {
          event.preventDefault();
          dispatchShortcut("refresh-orders");
        }
        return;
      }

      if (key === "escape") {
        dispatchShortcut("close-modal");
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [navigate, location.pathname]);

  useEffect(() => {
    if (location.pathname === "/orders") {
      const now = new Date().toISOString();
      lastSeenRef.current = now;
      window.localStorage.setItem("bb-pdv:lastSeenOrdersAt", now);
      setNewOrdersCount(0);
    }
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;

    const loadNotificationsSetting = async () => {
      if (!window.electronAPI || !window.electronAPI.getNotificationsEnabled) {
        return;
      }
      try {
        const result = await window.electronAPI.getNotificationsEnabled();
        if (mounted && typeof result.enabled === "boolean") {
          setNotificationsEnabled(result.enabled);
          if (!result.enabled) {
            setNewOrdersCount(0);
            setToastVisible(false);
          }
        }
      } catch (err) {
        console.error("[AppLayout] Erro ao buscar notificacoes:", err);
      }
    };

    loadNotificationsSetting();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleToast = (event) => {
      const detail = event.detail || {};
      const id = `toast_${Date.now()}_${toastIdRef.current++}`;
      const toast = {
        id,
        type: detail.type || "info",
        title: detail.title || "",
        message: detail.message || "",
        duration:
          typeof detail.duration === "number"  detail.duration : 4000,
      };

      setAppToasts((prev) => [...prev, toast]);

      if (toast.duration > 0) {
        const timer = setTimeout(() => {
          setAppToasts((prev) => prev.filter((t) => t.id !== id));
          toastTimersRef.current.delete(id);
        }, toast.duration);
        toastTimersRef.current.set(id, timer);
      }
    };

    window.addEventListener("app:toast", handleToast);
    return () => {
      window.removeEventListener("app:toast", handleToast);
      toastTimersRef.current.forEach((timer) => clearTimeout(timer));
      toastTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    let timer;

    const pollSyncStatus = async () => {
      if (!window.electronAPI || !window.electronAPI.getSyncStatus) return;
      try {
        const status = await window.electronAPI.getSyncStatus();
        setSyncStatus(status || null);
        if (status.lastPullErrorType === "dns") {
          setSyncAlert(
            "Sem conexao com o servidor (DNS). Aguarde o ngrok voltar ou atualize a URL."
          );
        } else {
          setSyncAlert(null);
        }
        if (!status.lastNewOrdersAt) return;
        if (status.lastNewOrdersAt === lastProcessedRef.current) return;
        lastProcessedRef.current = status.lastNewOrdersAt;

        const incomingTs = Date.parse(status.lastNewOrdersAt);
        const lastSeenTs = Date.parse(lastSeenRef.current || "");
        if (Number.isNaN(incomingTs)) return;
        if (!Number.isNaN(lastSeenTs) && incomingTs <= lastSeenTs) return;

        const increment = Number(status.lastNewOrdersCount || 0);
        if (increment > 0 && notificationsEnabled) {
          setNewOrdersCount((prev) => prev + increment);
          setToastMessage(
            increment === 1
               "Novo pedido do site."
              : `Novos pedidos do site: ${increment}.`
          );
          setToastVisible(true);
          if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
          }
          toastTimerRef.current = setTimeout(() => {
            setToastVisible(false);
          }, 8000);
        }
      } catch (err) {
        console.error("[AppLayout] Erro ao buscar sync status:", err);
      }
    };

    pollSyncStatus();
    timer = setInterval(pollSyncStatus, 5000);

    return () => {
      if (timer) clearInterval(timer);
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [notificationsEnabled]);

  const handleDisableNotifications = async () => {
    setNotificationsEnabled(false);
    setNewOrdersCount(0);
    setToastVisible(false);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    if (window.electronAPI && window.electronAPI.setNotificationsEnabled) {
      try {
        await window.electronAPI.setNotificationsEnabled(false);
      } catch (err) {
        console.error("[AppLayout] Erro ao desativar notificacoes:", err);
      }
    }
  };

  const handleCloseToast = () => {
    setToastVisible(false);
  };

  const handleDismissAppToast = (id) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) clearTimeout(timer);
    toastTimersRef.current.delete(id);
    setAppToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const formatSyncTime = (value) => {
    if (!value) return "nunca";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "nunca";
    return parsed.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSyncNow = async () => {
    if (!window.electronAPI.syncNow) return;
    setSyncNowError("");
    setSyncNowPending(true);
    try {
      const result = await window.electronAPI.syncNow();
      if (result.success === false) {
        setSyncNowError(result.error || "Falha ao sincronizar.");
      }
      const updated = await window.electronAPI.getSyncStatus();
      setSyncStatus(updated || null);
    } catch (err) {
      console.error("[AppLayout] Erro ao sincronizar agora:", err);
      setSyncNowError("Falha ao sincronizar.");
    } finally {
      setSyncNowPending(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <img className="app-logo" src="./AXIONPDV.png" alt="AXION PDV" />
          <span className="app-brand-text">AXION PDV</span>
        </div>

        <nav className="app-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={({ isActive }) =>
                "app-nav-link" + (isActive  " app-nav-link-active" : "")
              }
            >
              <span className="app-nav-link__label">{item.label}</span>
              {item.to === "/orders" && newOrdersCount > 0 && (
                <span className="app-nav-link__badge">{newOrdersCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        {appToasts.length > 0 && (
          <div className="app-toast-stack" role="status" aria-live="polite">
            {appToasts.map((toast) => (
              <div
                key={toast.id}
                className={`app-toast-card app-toast-card--${toast.type}`}
              >
                <div className="app-toast-card__body">
                  {toast.title && (
                    <div className="app-toast-card__title">
                      {toast.title}
                    </div>
                  )}
                  {toast.message && (
                    <div className="app-toast-card__message">
                      {toast.message}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="app-toast-card__close"
                  onClick={() => handleDismissAppToast(toast.id)}
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {syncAlert && (
          <div className="app-sync-alert" role="alert">
            {syncAlert}
          </div>
        )}
        {syncStatus && (
          <div className="app-sync-status" role="status" aria-live="polite">
            <div className="app-sync-status__left">
              <span
                className={
                  "app-sync-status__pill " +
                  (syncStatus.online  "is-online" : "is-offline")
                }
              >
                {syncStatus.online  "Online" : "Offline"}
              </span>
              <span>
                Última atualização (pull): {formatSyncTime(syncStatus.lastPullAt)}
              </span>
              <span>
                Último envio (push): {formatSyncTime(syncStatus.lastPushAt)}
              </span>
              {typeof syncStatus.queueRemaining === "number" &&
                syncStatus.queueRemaining > 0 && (
                  <span>Fila: {syncStatus.queueRemaining}</span>
                )}
              {syncStatus.lastPullError && (
                <span className="app-sync-status__error">
                  Erro: {syncStatus.lastPullError}
                </span>
              )}
              {syncStatus.lastPushError && !syncStatus.lastPullError && (
                <span className="app-sync-status__error">
                  Erro push: {syncStatus.lastPushError}
                </span>
              )}
            </div>
            <div className="app-sync-status__right">
              {syncNowError && (
                <span className="app-sync-status__error">{syncNowError}</span>
              )}
              <button
                type="button"
                className="app-sync-status__btn"
                onClick={handleSyncNow}
                disabled={syncNowPending}
              >
                {syncNowPending  "Sincronizando..." : "Sincronizar agora"}
              </button>
            </div>
          </div>
        )}
        {toastVisible && (
          <div className="app-toast" role="status" aria-live="polite">
            <div className="app-toast__text">{toastMessage}</div>
            <div className="app-toast__actions">
              <button
                type="button"
                className="app-toast__btn"
                onClick={handleCloseToast}
              >
                Fechar
              </button>
              <button
                type="button"
                className="app-toast__btn app-toast__btn--danger"
                onClick={handleDisableNotifications}
              >
                Parar alertas
              </button>
            </div>
          </div>
        )}

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;

