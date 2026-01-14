// src/tests/comprehensive-analysis.js
// Análise completa e correções automáticas

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('🔍 ANÁLISE COMPLETA E CORREÇÕES\n');

// Configurações
const projectRoot = path.join(__dirname, '../..');

// Análise 1: Verificação crítica de arquivos
function criticalFileAnalysis() {
  console.log('📋 1. ANÁLISE CRÍTICA DE ARQUIVOS');
  
  const criticalFiles = [
    'dist/index.html',
    'dist/assets/index-DVKlQ-mq.js',
    'dist/assets/index-BA1D6u8N.css',
    'src/renderer/main.jsx',
    'src/renderer/App.jsx',
    'electron/main.js',
    'electron/preload.js'
  ];
  
  let allOk = true;
  criticalFiles.forEach(file => {
    const filePath = path.join(projectRoot, file);
    const exists = fs.existsSync(filePath);
    console.log(`${exists  '✅' : '❌'} ${file}`);
    if (!exists) allOk = false;
  });
  
  return allOk;
}

// Análise 2: Verificação de conteúdo HTML
function htmlContentAnalysis() {
  console.log('\n📋 2. ANÁLISE DE CONTEÚDO HTML');
  
  const htmlPath = path.join(projectRoot, 'dist/index.html');
  if (!fs.existsSync(htmlPath)) {
    console.log('❌ HTML não encontrado');
    return false;
  }
  
  const html = fs.readFileSync(htmlPath, 'utf8');
  
  // Verificações críticas
  const checks = [
    { name: 'DOCTYPE', test: html.includes('<!DOCTYPE html>') },
    { name: 'HTML lang', test: html.includes('html lang') },
    { name: 'Meta charset', test: html.includes('charset=UTF-8') },
    { name: 'Root div', test: html.includes('<div id=\'root\'>') },
    { name: 'Script module', test: html.includes('type="module"') },
    { name: 'JS bundle', test: html.includes('index-DVKlQ-mq.js') },
    { name: 'CSS bundle', test: html.includes('index-BA1D6u8N.css') }
  ];
  
  checks.forEach(({ name, test }) => {
    console.log(`${test  '✅' : '❌'} ${name}`);
  });
  
  return checks.every(c => c.test);
}

// Análise 3: Verificação do JavaScript bundle
function jsBundleAnalysis() {
  console.log('\n📋 3. ANÁLISE DO JAVASCRIPT BUNDLE');
  
  const jsPath = path.join(projectRoot, 'dist/assets/index-DVKlQ-mq.js');
  if (!fs.existsSync(jsPath)) {
    console.log('❌ JavaScript bundle não encontrado');
    return false;
  }
  
  const js = fs.readFileSync(jsPath, 'utf8');
  
  // Verificações críticas
  const checks = [
    { name: 'React', test: js.includes('react') || js.includes('React') },
    { name: 'ReactDOM', test: js.includes('react-dom') || js.includes('ReactDOM') },
    { name: 'createRoot', test: js.includes('createRoot') },
    { name: 'App', test: js.includes('App') },
    { name: 'Router', test: js.includes('react-router') || js.includes('BrowserRouter') },
    { name: 'StrictMode', test: js.includes('StrictMode') },
    { name: 'HashRouter', test: js.includes('HashRouter') }
  ];
  
  checks.forEach(({ name, test }) => {
    console.log(`${test  '✅' : '❌'} ${name}`);
  });
  
  return checks.every(c => c.test);
}

// Análise 4: Verificação dos componentes React
function reactComponentsAnalysis() {
  console.log('\n📋 4. ANÁLISE DOS COMPONENTES REACT');
  
  const components = [
    'src/renderer/main.jsx',
    'src/renderer/App.jsx',
    'src/renderer/components/layout/AppLayout.jsx'
  ];
  
  let allOk = true;
  components.forEach(comp => {
    const compPath = path.join(projectRoot, comp);
    const exists = fs.existsSync(compPath);
    console.log(`${exists  '✅' : '❌'} ${comp}`);
    if (!exists) allOk = false;
  });
  
  // Verifica conteúdo do main.jsx
  const mainPath = path.join(projectRoot, 'src/renderer/main.jsx');
  if (fs.existsSync(mainPath)) {
    const mainContent = fs.readFileSync(mainPath, 'utf8');
    const checks = [
      { name: 'React import', test: mainContent.includes('import React') },
      { name: 'ReactDOM import', test: mainContent.includes('import ReactDOM') },
      { name: 'App import', test: mainContent.includes('import App') },
      { name: 'createRoot', test: mainContent.includes('createRoot') },
      { name: 'StrictMode', test: mainContent.includes('StrictMode') }
    ];
    
    console.log('  📄 main.jsx:');
    checks.forEach(({ name, test }) => {
      console.log(`    ${test  '✅' : '❌'} ${name}`);
    });
  }
  
  return allOk;
}

// Análise 5: Verificação do Electron
function electronAnalysis() {
  console.log('\n📋 5. ANÁLISE DO ELECTRON');
  
  const electronFiles = [
    'electron/main.js',
    'electron/preload.js',
    'electron/db.js'
  ];
  
  let allOk = true;
  electronFiles.forEach(file => {
    const filePath = path.join(projectRoot, file);
    const exists = fs.existsSync(filePath);
    console.log(`${exists  '✅' : '❌'} ${file}`);
    if (!exists) allOk = false;
  });
  
  // Verifica configuração do main.js
  const mainPath = path.join(projectRoot, 'electron/main.js');
  if (fs.existsSync(mainPath)) {
    const mainContent = fs.readFileSync(mainPath, 'utf8');
    const checks = [
      { name: 'BrowserWindow', test: mainContent.includes('BrowserWindow') },
      { name: 'loadFile', test: mainContent.includes('loadFile') },
      { name: 'preload.js', test: mainContent.includes('preload.js') },
      { name: 'contextIsolation', test: mainContent.includes('contextIsolation') },
      { name: 'nodeIntegration', test: mainContent.includes('nodeIntegration') },
      { name: 'IPC handlers', test: mainContent.includes('ipcMain.handle') }
    ];
    
    console.log('  📄 main.js:');
    checks.forEach(({ name, test }) => {
      console.log(`    ${test  '✅' : '❌'} ${name}`);
    });
  }
  
  // Verifica preload.js
  const preloadPath = path.join(projectRoot, 'electron/preload.js');
  if (fs.existsSync(preloadPath)) {
    const preloadContent = fs.readFileSync(preloadPath, 'utf8');
    const checks = [
      { name: 'contextBridge', test: preloadContent.includes('contextBridge') },
      { name: 'dataEngine', test: preloadContent.includes('dataEngine') },
      { name: 'ipcRenderer', test: preloadContent.includes('ipcRenderer') }
    ];
    
    console.log('  📄 preload.js:');
    checks.forEach(({ name, test }) => {
      console.log(`    ${test  '✅' : '❌'} ${name}`);
    });
  }
  
  return allOk;
}

// Correção 1: HTML melhorado
function fixHtmlFile() {
  console.log('\n🔧 1. APLICANDO CORREÇÕES NO HTML');
  
  const htmlPath = path.join(projectRoot, 'dist/index.html');
  if (!fs.existsSync(htmlPath)) {
    console.log('❌ HTML não encontrado para correção');
    return false;
  }
  
  const currentHtml = fs.readFileSync(htmlPath, 'utf8');
  
  // HTML melhorado com fallbacks
  const improvedHtml = `<!DOCTYPE html>
<html lang="pt-br">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="AXION PDV - Sistema de Ponto de Venda" />
    <link rel="icon" type="image/png" href="./assets/AXIONPDV-D09j4d4x.png" />
    <title>AXION PDV</title>
    <link rel="stylesheet" crossorigin href="./assets/index-BA1D6u8N.css">
    <style>
      /* Fallback styles */
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        background-color: #f5f7fb;
        color: #333;
      }
      #root {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }
      .loading {
        text-align: center;
        padding: 20px;
      }
      .loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #007bff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <div id='root'>
      <div class="loading">
        <div class="loading-spinner"></div>
        <div>🔍 AXION PDV - Carregando...</div>
        <div style="font-size: 14px; color: #666; margin-top: 10px;">
          Sistema de Ponto de Venda
        </div>
      </div>
    </div>
    <script type="module" crossorigin src="./assets/index-DVKlQ-mq.js"></script>
    <script>
      // Fallback para erros de carregamento
      window.addEventListener('error', function(e) {
        console.error('Erro de carregamento:', e);
        const root = document.getElementById('root');
        if (root) {
          root.innerHTML = '<div class="loading"><div style="color: red;">❌ Erro ao carregar aplicação</div><div>Verifique o console para detalhes</div></div>';
        }
      });
      
      // Timeout para detectar problemas
      setTimeout(function() {
        const root = document.getElementById('root');
        if (root && root.innerHTML.includes('Carregando...')) {
          console.warn('Aplicação demorando para carregar');
          root.innerHTML = '<div class="loading"><div style="color: orange;">⚠️ Aplicação demorando para carregar</div><div>Tente recarregar a página</div></div>';
        }
      }, 10000);
    </script>
  </body>
</html>`;
  
  fs.writeFileSync(htmlPath, improvedHtml);
  console.log('✅ HTML corrigido com fallbacks');
  return true;
}

// Correção 2: Verificar e corrigir main.jsx
function fixMainJsx() {
  console.log('\n🔧 2. VERIFICANDO E CORRIGINDO main.jsx');
  
  const mainPath = path.join(projectRoot, 'src/renderer/main.jsx');
  if (!fs.existsSync(mainPath)) {
    console.log('❌ main.jsx não encontrado');
    return false;
  }
  
  const currentMain = fs.readFileSync(mainPath, 'utf8');
  
  // Verifica se tem problemas
  const hasCreateRoot = currentMain.includes('createRoot');
  const hasStrictMode = currentMain.includes('StrictMode');
  const hasCorrectImport = currentMain.includes('import ReactDOM from "react-dom/client"');
  
  if (!hasCreateRoot || !hasStrictMode || !hasCorrectImport) {
    console.log('🔧 Corrigindo main.jsx...');
    
    const correctedMain = `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.scss";

// Garante que o DOM está pronto
const ensureRoot = () => {
  let root = document.getElementById('root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  }
  return root;
};

// Inicialização com tratamento de erros
try {
  const rootElement = ensureRoot();
  const root = ReactDOM.createRoot(rootElement);
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  console.log('✅ Aplicação React inicializada com sucesso');
} catch (error) {
  console.error('❌ Erro ao inicializar React:', error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">❌ Erro ao inicializar aplicação</div>';
  }
}`;
    
    fs.writeFileSync(mainPath, correctedMain);
    console.log('✅ main.jsx corrigido');
    return true;
  } else {
    console.log('✅ main.jsx já está correto');
    return true;
  }
}

// Correção 3: Verificar App.jsx
function fixAppJsx() {
  console.log('\n🔧 3. VERIFICANDO E CORRIGINDO App.jsx');
  
  const appPath = path.join(projectRoot, 'src/renderer/App.jsx');
  if (!fs.existsSync(appPath)) {
    console.log('❌ App.jsx não encontrado');
    return false;
  }
  
  const currentApp = fs.readFileSync(appPath, 'utf8');
  
  // Verifica se tem o router correto
  const hasRouter = currentApp.includes('BrowserRouter') || currentApp.includes('HashRouter');
  const hasErrorBoundary = currentApp.includes('ErrorBoundary') || currentApp.includes('componentDidCatch');
  
  if (!hasErrorBoundary) {
    console.log('🔧 Adicionando ErrorBoundary ao App.jsx...');
    
    const errorBoundaryComponent = `
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
          <h2>❌ Ocorreu um erro na aplicação</h2>
          <p>Verifique o console para detalhes técnicos</p>
          <button onClick={() => window.location.reload()}>
            Recarregar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}`;
    
    const correctedApp = errorBoundaryComponent + '\n\n' + currentApp.replace(
      'const App = () => {',
      'const App = () => {'
    ).replace(
      '<Router>',
      '<ErrorBoundary><Router>'
    ).replace(
      '</Router>',
      '</Router></ErrorBoundary>'
    );
    
    fs.writeFileSync(appPath, correctedApp);
    console.log('✅ App.jsx corrigido com ErrorBoundary');
    return true;
  } else {
    console.log('✅ App.jsx já está correto');
    return true;
  }
}

// Correção 4: Rebuild completo
function rebuildProject() {
  console.log('\n🔧 4. REBUILD COMPLETO');
  
  return new Promise((resolve) => {
    console.log('🔄 Limpando dist...');
    exec('npm run clean:dist', { cwd: projectRoot }, (error) => {
      if (error) {
        console.log('❌ Erro ao limpar dist:', error.message);
        resolve(false);
        return;
      }
      
      console.log('🔄 Fazendo build...');
      exec('npm run build', { cwd: projectRoot }, (error, stdout, stderr) => {
        if (error) {
          console.log('❌ Erro no build:', error.message);
          console.log('Stderr:', stderr);
          resolve(false);
          return;
        }
        
        console.log('✅ Build concluído com sucesso');
        console.log('🔄 Fazendo build do Electron...');
        exec('npm run electron:build', { cwd: projectRoot }, (error) => {
          if (error) {
            console.log('❌ Erro no build do Electron:', error.message);
            resolve(false);
            return;
          }
          
          console.log('✅ Build do Electron concluído');
          resolve(true);
        });
      });
    });
  });
}

// Função principal
async function main() {
  console.log('🎯 INICIANDO ANÁLISE COMPLETA E CORREÇÕES\n');
  
  // Análises
  const filesOk = criticalFileAnalysis();
  const htmlOk = htmlContentAnalysis();
  const jsOk = jsBundleAnalysis();
  const reactOk = reactComponentsAnalysis();
  const electronOk = electronAnalysis();
  
  console.log('\n📊 RESUMO DA ANÁLISE');
  console.log('='.repeat(50));
  console.log(`Arquivos críticos: ${filesOk  '✅' : '❌'}`);
  console.log(`HTML: ${htmlOk  '✅' : '❌'}`);
  console.log(`JavaScript: ${jsOk  '✅' : '❌'}`);
  console.log(`Componentes React: ${reactOk  '✅' : '❌'}`);
  console.log(`Electron: ${electronOk  '✅' : '❌'}`);
  
  // Aplica correções
  console.log('\n🔧 APLICANDO CORREÇÕES');
  console.log('='.repeat(50));
  
  const htmlFixed = fixHtmlFile();
  const mainFixed = fixMainJsx();
  const appFixed = fixAppJsx();
  
  // Rebuild
  const rebuildSuccess = await rebuildProject();
  
  // Verificação final
  console.log('\n🎯 RESULTADO FINAL');
  console.log('='.repeat(50));
  console.log(`HTML corrigido: ${htmlFixed  '✅' : '❌'}`);
  console.log(`main.jsx corrigido: ${mainFixed  '✅' : '❌'}`);
  console.log(`App.jsx corrigido: ${appFixed  '✅' : '❌'}`);
  console.log(`Rebuild concluído: ${rebuildSuccess  '✅' : '❌'}`);
  
  if (htmlFixed && mainFixed && appFixed && rebuildSuccess) {
    console.log('\n🎉 TODAS AS CORREÇÕES APLICADAS COM SUCESSO!');
    console.log('🚀 Execute o aplicativo para testar:');
    console.log('   dist-electron\\win-unpacked\\AXION PDV.exe');
    console.log('\n📋 Se ainda houver problemas:');
    console.log('   1. Abra DevTools (F12)');
    console.log('   2. Verifique o console');
    console.log('   3. Execute: debugApp()');
  } else {
    console.log('\n❌ ALGUMAS CORREÇÕES FALHARAM');
    console.log('📋 Verifique os erros acima e tente manualmente');
  }
  
  console.log('\n🌟 ANÁLISE E CORREÇÕES CONCLUÍDAS!');
}

main().catch(console.error);
