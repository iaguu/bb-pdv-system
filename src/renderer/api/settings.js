// src/renderer/api/settings.js
// API para gerenciar configurações do sistema

const getSettings = async () => {
  try {
    if (window.dataEngine && typeof window.dataEngine.get === 'function') {
      const result = await window.dataEngine.get('settings');
      return result || {};
    }
    
    // Fallback para localStorage
    const localSettings = localStorage.getItem('bb-pedidos-settings');
    return localSettings ? JSON.parse(localSettings) : {};
  } catch (error) {
    console.error('[SettingsAPI] Erro ao buscar configurações:', error);
    return {};
  }
};

const updateSettings = async (newSettings) => {
  try {
    if (window.dataEngine && typeof window.dataEngine.set === 'function') {
      await window.dataEngine.set('settings', newSettings);
      return true;
    }
    
    // Fallback para localStorage
    localStorage.setItem('bb-pedidos-settings', JSON.stringify(newSettings));
    return true;
  } catch (error) {
    console.error('[SettingsAPI] Erro ao atualizar configurações:', error);
    return false;
  }
};

export { getSettings, updateSettings };
