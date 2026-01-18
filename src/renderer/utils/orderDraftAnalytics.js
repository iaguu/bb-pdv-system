// src/renderer/utils/orderDraftAnalytics.js
// Melhorias de Analytics: Métricas, tracking, insights

// Analytics Engine
class DraftAnalyticsEngine {
  constructor() {
    this.events = [];
    this.metrics = new Map();
    this.aggregations = new Map();
    this.storageKey = 'draftAnalytics';
    this.maxEvents = 10000;
    this.batchSize = 100;
    this.flushInterval = 30000; // 30 segundos
    
    this.loadEvents();
    this.startBatchProcessor();
  }

  // Registra evento
  track(event, data = {}) {
    const analyticsEvent = {
      id: this.generateEventId(),
      event,
      data: this.sanitizeData(data),
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
      userId: this.getUserId(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      referrer: document.referrer
    };

    this.events.push(analyticsEvent);
    
    // Limita tamanho do buffer
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Atualiza métricas em tempo real
    this.updateMetrics(event, data);
    
    return analyticsEvent;
  }

  // Sanitiza dados para analytics
  sanitizeData(data) {
    if (!data) return {};

    const sanitized = { ...data };
    
    // Remove informações sensíveis
    const sensitiveFields = ['password', 'creditCard', 'ssn', 'cpf', 'token'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) delete sanitized[field];
    });

    // Limita tamanho de strings
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 500) {
        sanitized[key] = sanitized[key].substring(0, 500) + '...';
      }
    });

    return sanitized;
  }

  // Atualiza métricas
  updateMetrics(event, data) {
    // Contador de eventos
    const eventKey = `event:${event}`;
    this.metrics.set(eventKey, (this.metrics.get(eventKey) || 0) + 1);

    // Métricas específicas por tipo
    switch (event) {
      case 'draft_created':
        this.updateDraftCreationMetrics(data);
        break;
      case 'draft_updated':
        this.updateDraftUpdateMetrics(data);
        break;
      case 'draft_deleted':
        this.updateDraftDeletionMetrics(data);
        break;
      case 'draft_converted':
        this.updateDraftConversionMetrics(data);
        break;
    }
  }

  // Métricas de criação
  updateDraftCreationMetrics(data) {
    const hour = new Date().getHours();
    this.metrics.set(`drafts_by_hour:${hour}`, (this.metrics.get(`drafts_by_hour:${hour}`) || 0) + 1);
    
    if (data.customerType) {
      this.metrics.set(`drafts_by_customer_type:${data.customerType}`, 
        (this.metrics.get(`drafts_by_customer_type:${data.customerType}`) || 0) + 1);
    }
  }

  // Métricas de atualização
  updateDraftUpdateMetrics(data) {
    if (data.updateType) {
      this.metrics.set(`updates_by_type:${data.updateType}`, 
        (this.metrics.get(`updates_by_type:${data.updateType}`) || 0) + 1);
    }
  }

  // Métricas de deleção
  updateDraftDeletionMetrics(data) {
    const age = data.draftAge || 0;
    const ageGroup = this.getAgeGroup(age);
    this.metrics.set(`deletions_by_age:${ageGroup}`, 
      (this.metrics.get(`deletions_by_age:${ageGroup}`) || 0) + 1);
  }

  // Métricas de conversão
  updateDraftConversionMetrics(data) {
    const conversionTime = data.conversionTime || 0;
    const timeGroup = this.getTimeGroup(conversionTime);
    this.metrics.set(`conversions_by_time:${timeGroup}`, 
      (this.metrics.get(`conversions_by_time:${timeGroup}`) || 0) + 1);
  }

  // Obtém grupo de idade
  getAgeGroup(age) {
    if (age < 60000) return 'less_than_1_min';
    if (age < 300000) return '1_to_5_min';
    if (age < 1800000) return '5_to_30_min';
    if (age < 3600000) return '30_to_60_min';
    return 'more_than_1_hour';
  }

  // Obtém grupo de tempo
  getTimeGroup(time) {
    if (time < 60000) return 'less_than_1_min';
    if (time < 300000) return '1_to_5_min';
    if (time < 600000) return '5_to_10_min';
    if (time < 1800000) return '10_to_30_min';
    return 'more_than_30_min';
  }

  // Gera ID de evento
  generateEventId() {
    return `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Obtém session ID
  getSessionId() {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
  }

  // Obtém user ID
  getUserId() {
    return localStorage.getItem('user_id') || 'anonymous';
  }

  // Inicia processador em lote
  startBatchProcessor() {
    setInterval(() => {
      this.flushEvents();
    }, this.flushInterval);
  }

  // Envia eventos para servidor
  async flushEvents() {
    if (this.events.length === 0) return;

    const batch = this.events.splice(0, this.batchSize);
    
    try {
      await this.sendBatch(batch);
      this.saveEvents();
    } catch (error) {
      console.error('Failed to send analytics batch:', error);
      // Recoloca eventos no início da fila
      this.events.unshift(...batch);
    }
  }

  // Envia lote para servidor
  async sendBatch(events) {
    const response = await fetch('/api/analytics/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        events,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      })
    });

    if (!response.ok) {
      throw new Error(`Analytics batch failed: ${response.status}`);
    }

    return await response.json();
  }

  // Salva eventos localmente
  saveEvents() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        events: this.events,
        metrics: Array.from(this.metrics.entries()),
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Failed to save analytics:', error);
    }
  }

  // Carrega eventos localmente
  loadEvents() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.events = data.events || [];
        this.metrics = new Map(data.metrics || []);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
      this.events = [];
      this.metrics = new Map();
    }
  }

  // Obtém métricas
  getMetrics(filter = null) {
    if (!filter) {
      return Object.fromEntries(this.metrics);
    }

    const filtered = new Map();
    for (const [key, value] of this.metrics.entries()) {
      if (key.includes(filter)) {
        filtered.set(key, value);
      }
    }

    return Object.fromEntries(filtered);
  }

  // Obtém eventos
  getEvents(criteria = {}) {
    let filtered = [...this.events];

    if (criteria.event) {
      filtered = filtered.filter(e => e.event === criteria.event);
    }

    if (criteria.startDate) {
      const start = new Date(criteria.startDate).getTime();
      filtered = filtered.filter(e => e.timestamp >= start);
    }

    if (criteria.endDate) {
      const end = new Date(criteria.endDate).getTime();
      filtered = filtered.filter(e => e.timestamp <= end);
    }

    if (criteria.userId) {
      filtered = filtered.filter(e => e.userId === criteria.userId);
    }

    return filtered;
  }

  // Gera relatório
  generateReport(type, period = '24h') {
    const now = Date.now();
    const periods = {
      '1h': now - 3600000,
      '24h': now - 86400000,
      '7d': now - 604800000,
      '30d': now - 2592000000
    };

    const startTime = periods[period] || periods['24h'];
    const events = this.getEvents({ startDate: startTime });

    switch (type) {
      case 'summary':
        return this.generateSummaryReport(events);
      case 'usage':
        return this.generateUsageReport(events);
      case 'performance':
        return this.generatePerformanceReport(events);
      case 'conversion':
        return this.generateConversionReport(events);
      default:
        return this.generateSummaryReport(events);
    }
  }

  // Relatório de resumo
  generateSummaryReport(events) {
    const summary = {
      totalEvents: events.length,
      uniqueUsers: new Set(events.map(e => e.userId)).size,
      uniqueSessions: new Set(events.map(e => e.sessionId)).size,
      eventCounts: {},
      timeRange: {
        start: Math.min(...events.map(e => e.timestamp)),
        end: Math.max(...events.map(e => e.timestamp))
      }
    };

    events.forEach(event => {
      summary.eventCounts[event.event] = (summary.eventCounts[event.event] || 0) + 1;
    });

    return summary;
  }

  // Relatório de uso
  generateUsageReport(events) {
    const hourlyUsage = new Array(24).fill(0);
    const dailyUsage = new Array(7).fill(0);

    events.forEach(event => {
      const date = new Date(event.timestamp);
      hourlyUsage[date.getHours()]++;
      dailyUsage[date.getDay()]++;
    });

    return {
      hourlyUsage,
      dailyUsage,
      peakHour: hourlyUsage.indexOf(Math.max(...hourlyUsage)),
      peakDay: dailyUsage.indexOf(Math.max(...dailyUsage)),
      averageEventsPerHour: events.length / 24
    };
  }

  // Relatório de performance
  generatePerformanceReport(events) {
    const performanceEvents = events.filter(e => 
      e.event.includes('performance') || e.data.duration
    );

    const durations = performanceEvents
      .map(e => e.data.duration)
      .filter(d => d && d > 0);

    if (durations.length === 0) {
      return { message: 'No performance data available' };
    }

    durations.sort((a, b) => a - b);

    return {
      count: durations.length,
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      median: durations[Math.floor(durations.length / 2)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
      min: durations[0],
      max: durations[durations.length - 1]
    };
  }

  // Relatório de conversão
  generateConversionReport(events) {
    const createdEvents = events.filter(e => e.event === 'draft_created');
    const convertedEvents = events.filter(e => e.event === 'draft_converted');

    const conversionRate = createdEvents.length > 0
      ? (convertedEvents.length / createdEvents.length) * 100
      : 0;

    const conversionTimes = convertedEvents
      .map(e => e.data.conversionTime)
      .filter(t => t && t > 0);

    const avgConversionTime = conversionTimes.length > 0
      ? conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length
      : 0;

    return {
      totalCreated: createdEvents.length,
      totalConverted: convertedEvents.length,
      conversionRate: conversionRate.toFixed(2) + '%',
      averageConversionTime: avgConversionTime,
      conversionFunnel: this.generateConversionFunnel(events)
    };
  }

  // Funil de conversão
  generateConversionFunnel(events) {
    const stages = {
      created: events.filter(e => e.event === 'draft_created').length,
      updated: events.filter(e => e.event === 'draft_updated').length,
      previewed: events.filter(e => e.event === 'draft_previewed').length,
      converted: events.filter(e => e.event === 'draft_converted').length
    };

    const total = stages.created;
    const funnel = {};

    Object.keys(stages).forEach(stage => {
      funnel[stage] = {
        count: stages[stage],
        percentage:
          total > 0 ? ((stages[stage] / total) * 100).toFixed(1) : 0
      };
    });

    return funnel;
  }

  // Limpa recursos
  cleanup() {
    this.events = [];
    this.metrics.clear();
    this.aggregations.clear();
  }
}

// Heatmap Analytics
class DraftHeatmapAnalytics {
  constructor() {
    this.clickData = [];
    this.scrollData = [];
    this.dwellData = [];
    this.maxDataPoints = 1000;
  }

  // Registra clique
  trackClick(x, y, element, context = {}) {
    this.clickData.push({
      x,
      y,
      element: this.getElementSelector(element),
      context,
      timestamp: Date.now(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });

    if (this.clickData.length > this.maxDataPoints) {
      this.clickData.shift();
    }
  }

  // Registra scroll
  trackScroll(scrollY, direction) {
    this.scrollData.push({
      scrollY,
      direction,
      timestamp: Date.now(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });

    if (this.scrollData.length > this.maxDataPoints) {
      this.scrollData.shift();
    }
  }

  // Registra dwell time
  trackDwell(element, duration) {
    this.dwellData.push({
      element: this.getElementSelector(element),
      duration,
      timestamp: Date.now()
    });

    if (this.dwellData.length > this.maxDataPoints) {
      this.dwellData.shift();
    }
  }

  // Obtém seletor do elemento
  getElementSelector(element) {
    if (!element) return 'unknown';
    
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ').join('.')}`;
    return element.tagName.toLowerCase();
  }

  // Gera heatmap data
  generateHeatmap(type = 'click') {
    const data = type === 'click'
      ? this.clickData
      : type === 'scroll'
      ? this.scrollData
      : this.dwellData;

    return data.map(point => ({
      x: point.x,
      y: point.y,
      value: type === 'dwell' ? point.duration : 1,
      timestamp: point.timestamp
    }));
  }

  // Obtém hotspots
  getHotspots(type = 'click', threshold = 5) {
    const data = this.generateHeatmap(type);
    const gridSize = 50;
    const heatmap = {};

    // Agrupa pontos em grid
    data.forEach(point => {
      const gridX = Math.floor(point.x / gridSize);
      const gridY = Math.floor(point.y / gridSize);
      const key = `${gridX},${gridY}`;

      heatmap[key] = (heatmap[key] || 0) + point.value;
    });

    // Filtra hotspots
    return Object.entries(heatmap)
      .filter(([_, value]) => value >= threshold)
      .map(([key, value]) => {
        const [x, y] = key.split(',').map(Number);
        return {
          x: x * gridSize,
          y: y * gridSize,
          value,
          intensity: value / threshold
        };
      })
      .sort((a, b) => b.value - a.value);
  }

  // Limpa dados
  clear() {
    this.clickData = [];
    this.scrollData = [];
    this.dwellData = [];
  }
}

// Real-time Analytics
class DraftRealtimeAnalytics {
  constructor(analyticsEngine) {
    this.analytics = analyticsEngine;
    this.websocket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  // Conecta ao websocket
  connect() {
    if (this.websocket) {
      this.websocket.close();
    }

    try {
      this.websocket = new WebSocket('wss://api.example.com/analytics/realtime');
      
      this.websocket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('Real-time analytics connected');
      };

      this.websocket.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.websocket.onclose = () => {
        this.isConnected = false;
        this.handleReconnect();
      };

      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to connect to real-time analytics:', error);
      this.handleReconnect();
    }
  }

  // Handle reconnect
  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  // Handle mensagem
  handleMessage(data) {
    switch (data.type) {
      case 'metrics_update':
        this.handleMetricsUpdate(data.metrics);
        break;
      case 'alert':
        this.handleAlert(data.alert);
        break;
      case 'insight':
        this.handleInsight(data.insight);
        break;
    }
  }

  // Handle atualização de métricas
  handleMetricsUpdate(metrics) {
    // Emite evento para UI
    window.dispatchEvent(new CustomEvent('analytics-metrics-update', {
      detail: metrics
    }));
  }

  // Handle alerta
  handleAlert(alert) {
    // Emite alerta para UI
    window.dispatchEvent(new CustomEvent('analytics-alert', {
      detail: alert
    }));
  }

  // Handle insight
  handleInsight(insight) {
    // Emite insight para UI
    window.dispatchEvent(new CustomEvent('analytics-insight', {
      detail: insight
    }));
  }

  // Envia evento
  send(event, data) {
    if (this.isConnected && this.websocket) {
      this.websocket.send(JSON.stringify({ event, data }));
    }
  }

  // Disconecta
  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.isConnected = false;
  }
}

// Analytics Dashboard
class DraftAnalyticsDashboard {
  constructor(analyticsEngine) {
    this.analytics = analyticsEngine;
    this.heatmap = new DraftHeatmapAnalytics();
    this.realtime = new DraftRealtimeAnalytics(analyticsEngine);
    this.isTracking = false;
    
    this.setupEventTracking();
  }

  // Setup tracking de eventos
  setupEventTracking() {
    // Click tracking
    document.addEventListener('click', (e) => {
      if (this.isTracking) {
        this.heatmap.trackClick(e.clientX, e.clientY, e.target, {
          page: window.location.pathname
        });
      }
    });

    // Scroll tracking
    let lastScrollY = 0;
    window.addEventListener('scroll', () => {
      if (this.isTracking) {
        const currentScrollY = window.scrollY;
        const direction = currentScrollY > lastScrollY ? 'down' : 'up';
        this.heatmap.trackScroll(currentScrollY, direction);
        lastScrollY = currentScrollY;
      }
    });

    // Dwell time tracking
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const startTime = Date.now();
          
          const unobserve = () => {
            const duration = Date.now() - startTime;
            this.heatmap.trackDwell(entry.target, duration);
            observer.unobserve(entry.target);
          };

          setTimeout(unobserve, 100);
        }
      });
    });

    // Observa elementos importantes
    document.querySelectorAll('[data-track-dwell]').forEach(el => {
      observer.observe(el);
    });
  }

  // Inicia tracking
  startTracking() {
    this.isTracking = true;
    this.realtime.connect();
  }

  // Para tracking
  stopTracking() {
    this.isTracking = false;
    this.realtime.disconnect();
  }

  // Obtém dashboard data
  getDashboardData() {
    return {
      summary: this.analytics.generateReport('summary'),
      usage: this.analytics.generateReport('usage'),
      performance: this.analytics.generateReport('performance'),
      conversion: this.analytics.generateReport('conversion'),
      heatmap: this.heatmap.generateHeatmap(),
      hotspots: this.heatmap.getHotspots()
    };
  }

  // Limpa recursos
  cleanup() {
    this.stopTracking();
    this.heatmap.clear();
    this.analytics.cleanup();
  }
}

export {
  DraftAnalyticsEngine,
  DraftHeatmapAnalytics,
  DraftRealtimeAnalytics,
  DraftAnalyticsDashboard
};

export default DraftAnalyticsEngine;
