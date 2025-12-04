// src/renderer/pages/SettingsPage.jsx
import React, { useEffect, useState } from "react";
import Page from "../components/layout/Page";
import Button from "../components/common/Button";

const buildDefaultSettings = () => ({
  id: "default",
  pizzaria: "Anne & Tom",
  versao: "0.1.0",
  tema: "light",
  api: {
    base_url: "",
    api_key: "",
  },
  printing: {
    kitchenPrinterName: "",
    counterPrinterName: "",
    silentMode: true,
    autoPrintWebsiteOrders: false,
  },
});

const normalizeSettingsData = (data) => {
  if (!data) return null;

  // Caso 1: DataEngine padrão { items: [...] }
  if (Array.isArray(data.items) && data.items.length > 0) {
    return data.items[0];
  }

  // Caso 2: Arquivo seja um array puro: [ { ... } ]
  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }

  // Caso 3: Objeto plano
  if (typeof data === "object") {
    return data;
  }

  return null;
};

const SettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [printMessage, setPrintMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const data = await window.dataEngine.get("settings");
        console.log("[Settings] raw data from dataEngine:", data);

        let item = normalizeSettingsData(data);
        if (!item) {
          item = buildDefaultSettings();
        }

        // garante estrutura mínima
        if (!item.api) {
          item.api = { base_url: "", api_key: "" };
        }
        if (!item.tema) {
          item.tema = "light";
        }
        if (!item.versao) {
          item.versao = "0.1.0";
        }
        if (!item.pizzaria) {
          item.pizzaria = "Anne & Tom";
        }
        if (!item.id) {
          item.id = "default";
        }
        if (!item.printing) {
          item.printing = {
            kitchenPrinterName: "",
            counterPrinterName: "",
            silentMode: true,
            autoPrintWebsiteOrders: false,
          };
        } else {
          item.printing = {
            kitchenPrinterName:
              item.printing.kitchenPrinterName || "",
            counterPrinterName:
              item.printing.counterPrinterName || "",
            silentMode:
              item.printing.silentMode !== undefined
                ? !!item.printing.silentMode
                : true,
            autoPrintWebsiteOrders:
              !!item.printing.autoPrintWebsiteOrders,
          };
        }

        setSettings(item);
      } catch (err) {
        console.error("[Settings] Erro ao carregar:", err);
        setError("Não foi possível carregar as configurações.");
        setSettings(buildDefaultSettings());
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const handleChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApiChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      api: {
        ...(prev.api || {}),
        [field]: value,
      },
    }));
  };

  const handlePrintingChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      printing: {
        ...(prev.printing || {}),
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setError(null);

      await window.dataEngine.set("settings", {
        items: [settings],
      });

      console.log("[Settings] Salvo com sucesso:", settings);
      setPrintMessage("Configurações salvas com sucesso.");
      setTimeout(() => setPrintMessage(""), 3000);
    } catch (err) {
      console.error("[Settings] Erro ao salvar:", err);
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  // Teste de impressora de cozinha / balcão
  const handleTestPrinter = async (target) => {
    if (!window.electronAPI || !window.electronAPI.printTickets) {
      alert("Função de impressão não está disponível no app.");
      return;
    }

    const kitchenName = settings.printing?.kitchenPrinterName || "";
    const counterName = settings.printing?.counterPrinterName || "";
    const silent = settings.printing?.silentMode ?? true;

    try {
      setPrintMessage("");
      const isKitchen = target === "kitchen";

      const kitchenText = isKitchen
        ? `*** TESTE IMPRESSORA COZINHA ***\nPizzaria: ${
            settings.pizzaria
          }\nImpressora configurada: ${
            kitchenName || "padrão do sistema"
          }\nData: ${new Date().toLocaleString("pt-BR")}\n\nSe você está vendo este ticket na impressora correta, a configuração da cozinha está OK.`
        : "";

      const counterText = !isKitchen
        ? `*** TESTE IMPRESSORA BALCÃO / CONTA ***\nPizzaria: ${
            settings.pizzaria
          }\nImpressora configurada: ${
            counterName || "padrão do sistema"
          }\nData: ${new Date().toLocaleString("pt-BR")}\n\nSe você está vendo este ticket na impressora correta, a configuração do balcão está OK.`
        : "";

      // OBS: campos extra como kitchenPrinterName/counterPrinterName
      // podem ser usados futuramente no main.js para definir deviceName
      const payload = {
        kitchenText,
        counterText,
        silent: silent,
        kitchenPrinterName: kitchenName || null,
        counterPrinterName: counterName || null,
      };

      console.log("[Settings] Teste de impressão:", payload);

      const ok = await window.electronAPI.printTickets(payload);

      if (ok) {
        setPrintMessage(
          isKitchen
            ? "Ticket de teste enviado para a impressora da cozinha."
            : "Ticket de teste enviado para a impressora do balcão."
        );
      } else {
        setPrintMessage(
          "Não foi possível imprimir o ticket de teste. Verifique a impressora."
        );
      }
      setTimeout(() => setPrintMessage(""), 5000);
    } catch (err) {
      console.error("Erro ao testar impressora:", err);
      setPrintMessage(
        "Erro ao enviar ticket de teste. Veja o console do app."
      );
      setTimeout(() => setPrintMessage(""), 5000);
    }
  };

  // Enquanto está carregando pela primeira vez
  if (loading && !settings) {
    return (
      <Page
        title="Configurações"
        subtitle="Carregando configurações..."
      >
        <p>Carregando configurações...</p>
      </Page>
    );
  }

  // Se deu algum erro MUITO grave
  if (!settings) {
    return (
      <Page title="Configurações" subtitle="Erro ao carregar">
        <p>Algo deu errado ao carregar as configurações.</p>
      </Page>
    );
  }

  return (
    <Page
      title="Configurações"
      subtitle="Ajustes gerais da pizzaria, integrações e impressão."
      actions={
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      }
    >
      {error && (
        <p
          style={{
            color: "#c13f35",
            fontSize: 13,
            marginTop: 0,
            marginBottom: 8,
          }}
        >
          {error}
        </p>
      )}

      {printMessage && (
        <p
          style={{
            color: "#065f46",
            fontSize: 12,
            marginTop: 0,
            marginBottom: 10,
          }}
        >
          {printMessage}
        </p>
      )}

      <div className="settings-layout">
        {/* COLUNA ESQUERDA – Geral / Aparência / Integração */}
        <div className="settings-column">
          {/* Pizzaria */}
          <div className="settings-section">
            <div className="settings-section-title">
              Dados gerais
            </div>

            <div className="form-grid settings-grid">
              <label className="field">
                <span className="field-label">
                  Nome da pizzaria
                </span>
                <input
                  className="input"
                  value={settings.pizzaria || ""}
                  onChange={(e) =>
                    handleChange("pizzaria", e.target.value)
                  }
                />
              </label>

              <label className="field">
                <span className="field-label">
                  Versão do sistema
                </span>
                <input
                  className="input"
                  value={settings.versao || ""}
                  disabled
                />
              </label>

              <label className="field">
                <span className="field-label">Tema</span>
                <select
                  className="input"
                  value={settings.tema || "light"}
                  onChange={(e) =>
                    handleChange("tema", e.target.value)
                  }
                >
                  <option value="light">Claro</option>
                  <option value="dark">Escuro</option>
                </select>
              </label>
            </div>
          </div>

          {/* Integrações / API */}
          <div className="settings-section">
            <div className="settings-section-title">
              Integrações / API
            </div>

            <div className="form-grid settings-grid">
              <label className="field">
                <span className="field-label">API Base URL</span>
                <input
                  className="input"
                  value={settings.api?.base_url || ""}
                  onChange={(e) =>
                    handleApiChange("base_url", e.target.value)
                  }
                  placeholder="https://sua-api.com"
                />
                <span className="field-helper">
                  Endereço base para comunicação com site / app.
                </span>
              </label>

              <label className="field">
                <span className="field-label">API Key</span>
                <input
                  className="input"
                  value={settings.api?.api_key || ""}
                  onChange={(e) =>
                    handleApiChange("api_key", e.target.value)
                  }
                  placeholder="chave de autenticação"
                />
                <span className="field-helper">
                  Não compartilhe essa chave com terceiros.
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA – Impressão */}
        <div className="settings-column">
          <div className="settings-section">
            <div className="settings-section-title">
              Impressão de pedidos
            </div>

            <div className="settings-printing-grid">
              <div className="settings-printing-block">
                <div className="field-label">
                  Impressora da cozinha
                </div>
                <input
                  className="input"
                  value={
                    settings.printing?.kitchenPrinterName || ""
                  }
                  onChange={(e) =>
                    handlePrintingChange(
                      "kitchenPrinterName",
                      e.target.value
                    )
                  }
                  placeholder="Nome exato da impressora no sistema"
                />
                <div className="field-helper">
                  Ex: &quot;EPSON TM-T20&quot;. Use o nome exibido no
                  gerenciador de impressoras.
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => handleTestPrinter("kitchen")}
                  style={{ marginTop: 8 }}
                >
                  Testar impressora da cozinha
                </Button>
              </div>

              <div className="settings-printing-block">
                <div className="field-label">
                  Impressora do balcão / conta
                </div>
                <input
                  className="input"
                  value={
                    settings.printing?.counterPrinterName || ""
                  }
                  onChange={(e) =>
                    handlePrintingChange(
                      "counterPrinterName",
                      e.target.value
                    )
                  }
                  placeholder="Nome exato da impressora no sistema"
                />
                <div className="field-helper">
                  Usada para impressão de conta / comprovante.
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => handleTestPrinter("counter")}
                  style={{ marginTop: 8 }}
                >
                  Testar impressora do balcão
                </Button>
              </div>
            </div>

            <div className="settings-printing-options">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={
                    settings.printing?.silentMode ?? true
                  }
                  onChange={(e) =>
                    handlePrintingChange(
                      "silentMode",
                      e.target.checked
                    )
                  }
                />
                <span>
                  Impressão silenciosa (sem dialog de impressão)
                </span>
              </label>

              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={
                    settings.printing?.autoPrintWebsiteOrders ||
                    false
                  }
                  onChange={(e) =>
                    handlePrintingChange(
                      "autoPrintWebsiteOrders",
                      e.target.checked
                    )
                  }
                />
                <span>
                  Imprimir automaticamente pedidos vindos do site
                </span>
              </label>

              <p className="settings-printing-helper">
                As impressoras configuradas aqui podem ser usadas
                pelo módulo de Pedidos para imprimir automaticamente
                tickets de cozinha e conta, com base nos pedidos
                recebidos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
};

export default SettingsPage;
