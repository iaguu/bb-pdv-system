// src/tests/comprehensive-analysis.js
// AnÃƒÆ’Ã‚Â¡lise completa e correÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes automÃƒÆ’Ã‚Â¡ticas

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â ANÃƒÆ’Ã‚ÂLISE COMPLETA E CORREÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES\n');

// ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
const projectRoot = path.join(__dirname, '../..');

// AnÃƒÆ’Ã‚Â¡lise 1: VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o crÃƒÆ’Ã‚Â­tica de arquivos
function criticalFileAnalysis() {
  console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ 1. ANÃƒÆ’Ã‚ÂLISE CRÃƒÆ’Ã‚ÂTICA DE ARQUIVOS');
  
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
    console.log(`${exists ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} ${file}`);
    if (!exists) allOk = false;
  });
  
  return allOk;
}

// AnÃƒÆ’Ã‚Â¡lise 2: VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de conteÃƒÆ’Ã‚Âºdo HTML
function htmlContentAnalysis() {
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ 2. ANÃƒÆ’Ã‚ÂLISE DE CONTEÃƒÆ’Ã…Â¡DO HTML');
  
  const htmlPath = path.join(projectRoot, 'dist/index.html');
  if (!fs.existsSync(htmlPath)) {
    console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ HTML nÃƒÆ’Ã‚Â£o encontrado');
    return false;
  }
  
  const html = fs.readFileSync(htmlPath, 'utf8');
  
  // VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes crÃƒÆ’Ã‚Â­ticas
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
    console.log(`${test ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} ${name}`);
  });
  
  return checks.every(c => c.test);
}

// AnÃƒÆ’Ã‚Â¡lise 3: VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do JavaScript bundle
function jsBundleAnalysis() {
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ 3. ANÃƒÆ’Ã‚ÂLISE DO JAVASCRIPT BUNDLE');
  
  const jsPath = path.join(projectRoot, 'dist/assets/index-DVKlQ-mq.js');
  if (!fs.existsSync(jsPath)) {
    console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ JavaScript bundle nÃƒÆ’Ã‚Â£o encontrado');
    return false;
  }
  
  const js = fs.readFileSync(jsPath, 'utf8');
  
  // VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes crÃƒÆ’Ã‚Â­ticas
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
    console.log(`${test ? '?' : '?'} ${name}`);
  });
  
  return checks.every(c => c.test);
}

// AnÃƒÆ’Ã‚Â¡lise 4: VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o dos componentes React
function reactComponentsAnalysis() {
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ 4. ANÃƒÆ’Ã‚ÂLISE DOS COMPONENTES REACT');
  
  const components = [
    'src/renderer/main.jsx',
    'src/renderer/App.jsx',
    'src/renderer/components/layout/AppLayout.jsx'
  ];
  
  let allOk = true;
  components.forEach(comp => {
    const compPath = path.join(projectRoot, comp);
    const exists = fs.existsSync(compPath);
    console.log(`${exists ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} ${comp}`);
    if (!exists) allOk = false;
  });
  
  // Verifica conteÃƒÆ’Ã‚Âºdo do main.jsx
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
    
    console.log('  ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾ main.jsx:');
    checks.forEach(({ name, test }) => {
      console.log(`    ${test ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} ${name}`);
    });
  }
  
  return allOk;
}

// AnÃƒÆ’Ã‚Â¡lise 5: VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do Electron
function electronAnalysis() {
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ 5. ANÃƒÆ’Ã‚ÂLISE DO ELECTRON');
  
  const electronFiles = [
    'electron/main.js',
    'electron/preload.js',
    'electron/db.js'
  ];
  
  let allOk = true;
  electronFiles.forEach(file => {
    const filePath = path.join(projectRoot, file);
    const exists = fs.existsSync(filePath);
    console.log(`${exists ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} ${file}`);
    if (!exists) allOk = false;
  });
  
  // Verifica configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do main.js
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
    
    console.log('  ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾ main.js:');
    checks.forEach(({ name, test }) => {
      console.log(`    ${test ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} ${name}`);
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
    
    console.log('  ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾ preload.js:');
    checks.forEach(({ name, test }) => {
      console.log(`    ${test ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} ${name}`);
    });
  }
  
  return allOk;
}

// CorreÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o 1: HTML melhorado
function fixHtmlFile() {
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â§ 1. APLICANDO CORREÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES NO HTML');
  
  const htmlPath = path.join(projectRoot, 'dist/index.html');
  if (!fs.existsSync(htmlPath)) {
    console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ HTML nÃƒÆ’Ã‚Â£o encontrado para correÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o');
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
        <div>ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â AXION PDV - Carregando...</div>
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
          root.innerHTML = '<div class="loading"><div style="color: red;">ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao carregar aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o</div><div>Verifique o console para detalhes</div></div>';
        }
      });
      
      // Timeout para detectar problemas
      setTimeout(function() {
        const root = document.getElementById('root');
        if (root && root.innerHTML.includes('Carregando...')) {
          console.warn('AplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o demorando para carregar');
          root.innerHTML = '<div class="loading"><div style="color: orange;">ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â AplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o demorando para carregar</div><div>Tente recarregar a pÃƒÆ’Ã‚Â¡gina</div></div>';
        }
      }, 10000);
    </script>
  </body>
</html>`;
  
  fs.writeFileSync(htmlPath, improvedHtml);
  console.log('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ HTML corrigido com fallbacks');
  return true;
}

// CorreÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o 2: Verificar e corrigir main.jsx
function fixMainJsx() {
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â§ 2. VERIFICANDO E CORRIGINDO main.jsx');
  
  const mainPath = path.join(projectRoot, 'src/renderer/main.jsx');
  if (!fs.existsSync(mainPath)) {
    console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ main.jsx nÃƒÆ’Ã‚Â£o encontrado');
    return false;
  }
  
  const currentMain = fs.readFileSync(mainPath, 'utf8');
  
  // Verifica se tem problemas
  const hasCreateRoot = currentMain.includes('createRoot');
  const hasStrictMode = currentMain.includes('StrictMode');
  const hasCorrectImport = currentMain.includes('import ReactDOM from "react-dom/client"');
  
  if (!hasCreateRoot || !hasStrictMode || !hasCorrectImport) {
    console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â§ Corrigindo main.jsx...');
    
    const correctedMain = `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.scss";

// Garante que o DOM estÃƒÆ’Ã‚Â¡ pronto
const ensureRoot = () => {
  let root = document.getElementById('root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  }
  return root;
};

// InicializaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o com tratamento de erros
try {
  const rootElement = ensureRoot();
  const root = ReactDOM.createRoot(rootElement);
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  console.log('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ AplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o React inicializada com sucesso');
} catch (error) {
  console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao inicializar React:', error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao inicializar aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o</div>';
  }
}`;
    
    fs.writeFileSync(mainPath, correctedMain);
    console.log('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ main.jsx corrigido');
    return true;
  } else {
    console.log('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ main.jsx jÃƒÆ’Ã‚Â¡ estÃƒÆ’Ã‚Â¡ correto');
    return true;
  }
}

// CorreÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o 3: Verificar App.jsx
function fixAppJsx() {
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â§ 3. VERIFICANDO E CORRIGINDO App.jsx');
  
  const appPath = path.join(projectRoot, 'src/renderer/App.jsx');
  if (!fs.existsSync(appPath)) {
    console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ App.jsx nÃƒÆ’Ã‚Â£o encontrado');
    return false;
  }
  
  const currentApp = fs.readFileSync(appPath, 'utf8');
  
  // Verifica se tem o router correto
  const hasRouter = currentApp.includes('BrowserRouter') || currentApp.includes('HashRouter');
  const hasErrorBoundary = currentApp.includes('ErrorBoundary') || currentApp.includes('componentDidCatch');
  
  if (!hasErrorBoundary) {
    console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â§ Adicionando ErrorBoundary ao App.jsx...');
    
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
          <h2>ÃƒÂ¢Ã‚ÂÃ…â€™ Ocorreu um erro na aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o</h2>
          <p>Verifique o console para detalhes tÃƒÆ’Ã‚Â©cnicos</p>
          <button onClick={() => window.location.reload()}>
            Recarregar PÃƒÆ’Ã‚Â¡gina
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
    console.log('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ App.jsx corrigido com ErrorBoundary');
    return true;
  } else {
    console.log('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ App.jsx jÃƒÆ’Ã‚Â¡ estÃƒÆ’Ã‚Â¡ correto');
    return true;
  }
}

// CorreÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o 4: Rebuild completo
function rebuildProject() {
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â§ 4. REBUILD COMPLETO');
  
  return new Promise((resolve) => {
    console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾ Limpando dist...');
    exec('npm run clean:dist', { cwd: projectRoot }, (error) => {
      if (error) {
        console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao limpar dist:', error.message);
        resolve(false);
        return;
      }
      
      console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾ Fazendo build...');
      exec('npm run build', { cwd: projectRoot }, (error, stdout, stderr) => {
        if (error) {
          console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro no build:', error.message);
          console.log('Stderr:', stderr);
          resolve(false);
          return;
        }
        
        console.log('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Build concluÃƒÆ’Ã‚Â­do com sucesso');
        console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾ Fazendo build do Electron...');
        exec('npm run electron:build', { cwd: projectRoot }, (error) => {
          if (error) {
            console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ Erro no build do Electron:', error.message);
            resolve(false);
            return;
          }
          
          console.log('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Build do Electron concluÃƒÆ’Ã‚Â­do');
          resolve(true);
        });
      });
    });
  });
}

// FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o principal
async function main() {
  console.log('ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¯ INICIANDO ANÃƒÆ’Ã‚ÂLISE COMPLETA E CORREÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES\n');
  
  // AnÃƒÆ’Ã‚Â¡lises
  const filesOk = criticalFileAnalysis();
  const htmlOk = htmlContentAnalysis();
  const jsOk = jsBundleAnalysis();
  const reactOk = reactComponentsAnalysis();
  const electronOk = electronAnalysis();
  
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â  RESUMO DA ANÃƒÆ’Ã‚ÂLISE');
  console.log('='.repeat(50));
  console.log(`Arquivos crÃƒÆ’Ã‚Â­ticos: ${filesOk ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'}`);
  console.log(`HTML: ${htmlOk ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'}`);
  console.log(`JavaScript: ${jsOk ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'}`);
  console.log(`Componentes React: ${reactOk ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'}`);
  console.log(`Electron: ${electronOk ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'}`);
  
  // Aplica correÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â§ APLICANDO CORREÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES');
  console.log('='.repeat(50));
  
  const htmlFixed = fixHtmlFile();
  const mainFixed = fixMainJsx();
  const appFixed = fixAppJsx();
  
  // Rebuild
  const rebuildSuccess = await rebuildProject();
  
  // VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o final
  console.log('\nÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¯ RESULTADO FINAL');
  console.log('='.repeat(50));
  console.log(`HTML corrigido: ${htmlFixed ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'}`);
  console.log(`main.jsx corrigido: ${mainFixed ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'}`);
  console.log(`App.jsx corrigido: ${appFixed ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'}`);
  console.log(`Rebuild concluÃƒÆ’Ã‚Â­do: ${rebuildSuccess ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'}`);
  
  if (htmlFixed && mainFixed && appFixed && rebuildSuccess) {
    console.log('\nÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Â° TODAS AS CORREÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES APLICADAS COM SUCESSO!');
    console.log('ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ Execute o aplicativo para testar:');
    console.log('   dist-electron\\win-unpacked\\AXION PDV.exe');
    console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ Se ainda houver problemas:');
    console.log('   1. Abra DevTools (F12)');
    console.log('   2. Verifique o console');
    console.log('   3. Execute: debugApp()');
  } else {
    console.log('\nÃƒÂ¢Ã‚ÂÃ…â€™ ALGUMAS CORREÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES FALHARAM');
    console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ Verifique os erros acima e tente manualmente');
  }
  
  console.log('\nÃƒÂ°Ã…Â¸Ã…â€™Ã…Â¸ ANÃƒÆ’Ã‚ÂLISE E CORREÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES CONCLUÃƒÆ’Ã‚ÂDAS!');
}

main().catch(console.error);
