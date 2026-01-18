// src/renderer/debug-console.js
// Script para debug direto no console do aplicativo

// Função para verificar o estado da aplicação
function debugAppState() {
  console.log('🔍 DEBUG DO ESTADO DA APLICAÇÃO');
  console.log('='.repeat(50));
  
  // 1. Verificação do DOM
  console.log('📋 1. VERIFICAÇÃO DO DOM');
  console.log('DOM ready:', document.readyState);
  
  const root = document.getElementById('root');
  console.log('Root element:', root);
  console.log('Root exists:', !!root);
  
  if (root) {
    console.log('Root children:', root.children.length);
    console.log('Root innerHTML length:', root.innerHTML.length);
    console.log('Root has content:', root.innerHTML.length > 0);
    
    if (root.innerHTML.length === 0) {
      console.log('❌ Root element está vazio!');
    } else {
      console.log('✅ Root element tem conteúdo');
      console.log('Root content preview:', root.innerHTML.substring(0, 200) + '...');
    }
  }
  
  // 2. Verificação do React
  console.log('\n📋 2. VERIFICAÇÃO DO REACT');
  console.log('React:', window.React);
  console.log('ReactDOM:', window.ReactDOM);
  console.log('React version:', window.React.version);
  
  if (window.React) {
    console.log('✅ React carregado');
  } else {
    console.log('❌ React não carregado');
  }
  
  // 3. Verificação de estilos
  console.log('\n📋 3. VERIFICAÇÃO DE ESTILOS');
  const styles = document.querySelectorAll('link[rel="stylesheet"]');
  console.log('CSS files loaded:', styles.length);
  
  styles.forEach((link, index) => {
    console.log(`CSS ${index}:`, link.href);
  });
  
  // Verifica se há estilos aplicados ao root
  if (root) {
    const rootStyles = getComputedStyle(root);
    console.log('Root display:', rootStyles.display);
    console.log('Root visibility:', rootStyles.visibility);
    console.log('Root opacity:', rootStyles.opacity);
    console.log('Root position:', rootStyles.position);
  }
  
  // 4. Verificação de scripts
  console.log('\n📋 4. VERIFICAÇÃO DE SCRIPTS');
  const scripts = document.querySelectorAll('script');
  console.log('Scripts loaded:', scripts.length);
  
  scripts.forEach((script, index) => {
    console.log(`Script ${index}:`, script.src || 'inline');
  });
  
  // 5. Verificação do dataEngine
  console.log('\n📋 5. VERIFICAÇÃO DO DATAENGINE');
  console.log('DataEngine:', window.dataEngine);
  
  if (window.dataEngine) {
    console.log('✅ DataEngine disponível');
    console.log('DataEngine methods:', Object.keys(window.dataEngine));
  } else {
    console.log('❌ DataEngine não disponível');
  }
  
  // 6. Verificação de erros
  console.log('\n📋 6. VERIFICAÇÃO DE ERROS');
  const originalError = console.error;
  const errorCount = [];
  
  // Captura erros futuros por 10 segundos
  console.error = function(...args) {
    errorCount.push(args);
    originalError.apply(console, args);
    console.log('🚨 Novo erro capturado:', args);
  };
  
  setTimeout(() => {
    console.log('Erros capturados nos últimos 10s:', errorCount.length);
    if (errorCount.length > 0) {
      console.log('Erros:', errorCount);
    }
  }, 10000);
  
  // 7. Verificação de performance
  console.log('\n📋 7. VERIFICAÇÃO DE PERFORMANCE');
  const navigation = performance.getEntriesByType('navigation')[0];
  if (navigation) {
    console.log('Load time:', navigation.loadEventEnd - navigation.loadEventStart, 'ms');
    console.log('DOM interactive:', navigation.domInteractive - navigation.fetchStart, 'ms');
    console.log('First paint:', navigation.responseStart - navigation.fetchStart, 'ms');
  }
  
  // 8. Verificação de componentes
  console.log('\n📋 8. VERIFICAÇÃO DE COMPONENTES');
  
  // Tenta encontrar elementos React
  const reactElements = document.querySelectorAll('[data-reactroot]');
  console.log('React elements found:', reactElements.length);
  
  // Verifica se há algum conteúdo visível
  const visibleElements = document.querySelectorAll('*');
  const hasVisibleContent = Array.from(visibleElements).some(el => {
    const styles = getComputedStyle(el);
    return styles.display !== 'none' && 
           styles.visibility !== 'hidden' && 
           styles.opacity !== '0' &&
           el.offsetWidth > 0 && 
           el.offsetHeight > 0;
  });
  
  console.log('Has visible content:', hasVisibleContent);
  
  console.log('\n🎯 DIAGNÓSTICO FINAL');
  console.log('='.repeat(50));
  
  // Diagnóstico final
  const issues = [];
  
  if (!root) {
    issues.push('Elemento #root não encontrado');
  } else if (root.innerHTML.length === 0) {
    issues.push('Elemento #root está vazio');
  }
  
  if (!window.React) {
    issues.push('React não carregado');
  }
  
  if (!window.dataEngine) {
    issues.push('DataEngine não disponível');
  }
  
  if (!hasVisibleContent) {
    issues.push('Nenhum conteúdo visível encontrado');
  }
  
  if (issues.length === 0) {
    console.log('✅ NENHUM PROBLEMA DETECTADO');
    console.log('A aplicação parece estar funcionando corretamente');
  } else {
    console.log('❌ PROBLEMAS DETECTADOS:');
    issues.forEach(issue => console.log(`   - ${issue}`));
  }
  
  console.log('\n🌟 DEBUG CONCLUÍDO!');
  
  return {
    hasRoot: !!root,
    rootHasContent: root ? root.innerHTML.length > 0 : false,
    hasReact: !!window.React,
    hasDataEngine: !!window.dataEngine,
    hasVisibleContent,
    issues
  };
}

// Função para tentar corrigir problemas comuns
function tryFixCommonIssues() {
  console.log('🔧 TENTANDO CORRIGIR PROBLEMAS COMUNS');
  
  // 1. Força re-renderização do React
  if (window.React && window.ReactDOM && document.getElementById('root')) {
    console.log('🔄 Tentando re-renderizar React...');
    
    // Tenta encontrar o componente App
    const root = document.getElementById('root');
    if (root && root.innerHTML.length === 0) {
      console.log('📝 Root vazio, tentando recarregar...');
      window.location.reload();
    }
  }
  
  // 2. Verifica se há problemas de CSS
  const root = document.getElementById('root');
  if (root) {
    const styles = getComputedStyle(root);
    if (styles.display === 'none') {
      console.log('🔧 Corrigindo display do root...');
      root.style.display = 'block';
    }
    
    if (styles.visibility === 'hidden') {
      console.log('🔧 Corrigindo visibility do root...');
      root.style.visibility = 'visible';
    }
    
    if (styles.opacity === '0') {
      console.log('🔧 Corrigindo opacity do root...');
      root.style.opacity = '1';
    }
  }
  
  // 3. Adiciona estilos básicos se necessário
  if (root && root.innerHTML.length === 0) {
    console.log('🔧 Adicionando estilos básicos...');
    root.style.minHeight = '100vh';
    root.style.backgroundColor = '#f5f7fb';
    root.style.display = 'flex';
    root.style.alignItems = 'center';
    root.style.justifyContent = 'center';
    root.style.fontSize = '18px';
    root.style.color = '#333';
    root.innerHTML = '<div>🔍 AXION PDV - Carregando...</div>';
  }
}

// Executa o debug
console.log('🚀 Iniciando debug da aplicação...');
debugAppState();

// Executa correções após 2 segundos
setTimeout(() => {
  console.log('\n🔧 Executando correções automáticas...');
  tryFixCommonIssues();
}, 2000);

// Exporta funções para uso manual
window.debugApp = debugAppState;
window.tryFix = tryFixCommonIssues;

console.log('\n📋 Funções disponíveis no console:');
console.log('debugApp() - Executa diagnóstico completo');
console.log('tryFix() - Tenta corrigir problemas comuns');
