// src/tests/white-screen-diagnosis.js
// DiagnÃƒÆ’Ã‚Â³stico completo do problema de tela branca

const fs = require('fs');
const path = require('path');

console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â DIAGNÃƒÆ’Ã¢â‚¬Å“STICO COMPLETO - TELA BRANCA\n');

// ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
const projectRoot = path.join(__dirname, '../..');
const distPath = path.join(projectRoot, 'dist');
const electronDistPath = path.join(projectRoot, 'dist-electron');

// FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o auxiliar para verificar arquivos
function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  const stats = exists ? fs.statSync(filePath) : null;
  
  console.log(`${exists ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} ${description}`);
  if (exists && stats) {
    console.log(`   ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â Path: ${filePath}`);
    console.log(`   ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â  Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`   ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¦ Modified: ${stats.mtime.toLocaleString('pt-BR')}`);
  } else if (!exists) {
    console.log(`   ÃƒÂ¢Ã‚ÂÃ…â€™ Arquivo nÃƒÆ’Ã‚Â£o encontrado: ${filePath}`);
  }
  return exists;
}

// FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o para verificar conteÃƒÆ’Ã‚Âºdo de arquivos crÃƒÆ’Ã‚Â­ticos
function checkFileContent(filePath, criticalStrings = []) {
  if (!fs.existsSync(filePath)) {
    console.log(`ÃƒÂ¢Ã‚ÂÃ…â€™ Arquivo nÃƒÆ’Ã‚Â£o existe: ${filePath}`);
    return false;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const missingStrings = criticalStrings.filter(str => !content.includes(str));
    
    if (missingStrings.length === 0) {
      console.log(`ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ ConteÃƒÆ’Ã‚Âºdo crÃƒÆ’Ã‚Â­tico OK: ${path.basename(filePath)}`);
      return true;
    } else {
      console.log(`ÃƒÂ¢Ã‚ÂÃ…â€™ ConteÃƒÆ’Ã‚Âºdo crÃƒÆ’Ã‚Â­tico faltando em ${path.basename(filePath)}:`);
      missingStrings.forEach(str => console.log(`   - "${str}"`));
      return false;
    }
  } catch (error) {
    console.log(`ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao ler ${path.basename(filePath)}: ${error.message}`);
    return false;
  }
}

console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ 1. VERIFICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DE ARQUIVOS CRÃƒÆ’Ã‚ÂTICOS\n');

// Verificar arquivos de build
const buildFiles = [
  { path: path.join(distPath, 'index.html'), desc: 'HTML principal' },
  { path: path.join(distPath, 'assets', 'index-DVKlQ-mq.js'), desc: 'JavaScript principal' },
  { path: path.join(distPath, 'assets', 'index-BA1D6u8N.css'), desc: 'CSS principal' },
  { path: path.join(distPath, 'assets', 'AXIONPDV-D09j4d4x.png'), desc: 'Logo/Imagem' }
];

let allFilesExist = true;
buildFiles.forEach(({ path: filePath, desc }) => {
  if (!checkFile(filePath, desc)) {
    allFilesExist = false;
  }
});

console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ 2. VERIFICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DE CONTEÃƒÆ’Ã…Â¡DO CRÃƒÆ’Ã‚ÂTICO\n');

// Verificar conteÃƒÆ’Ã‚Âºdo do HTML
checkFileContent(
  path.join(distPath, 'index.html'),
  ['<!DOCTYPE html>', '<div id=\'root\'>', '<script', 'index-DVKlQ-mq.js']
);

// Verificar se o JavaScript tem o conteÃƒÆ’Ã‚Âºdo React
const jsPath = path.join(distPath, 'assets', 'index-DVKlQ-mq.js');
if (fs.existsSync(jsPath)) {
  try {
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    const hasReact = jsContent.includes('react') || jsContent.includes('React');
    const hasReactDOM = jsContent.includes('react-dom') || jsContent.includes('ReactDOM');
    const hasCreateRoot = jsContent.includes('createRoot');
    const hasApp = jsContent.includes('App');
    
    console.log(`${hasReact ? '?' : '?'} React encontrado no bundle`);
    console.log(`${hasReactDOM ? '?' : '?'} ReactDOM encontrado no bundle`);
    console.log(`${hasCreateRoot ? '?' : '?'} createRoot encontrado no bundle`);
    console.log(`${hasApp ? '?' : '?'} App component encontrado no bundle`);
    
    if (!hasReact || !hasReactDOM || !hasCreateRoot) {
      console.log('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â PossÃƒÆ’Ã‚Â­vel problema no bundle do JavaScript');
    }
  } catch (error) {
    console.log(`ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao analisar JavaScript: ${error.message}`);
  }
}

console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ 3. VERIFICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DO ELECTRON\n');

// Verificar arquivos do Electron
const electronFiles = [
  { path: path.join(projectRoot, 'electron', 'main.js'), desc: 'Main process' },
  { path: path.join(projectRoot, 'electron', 'preload.js'), desc: 'Preload script' },
  { path: path.join(projectRoot, 'electron', 'db.js'), desc: 'Database layer' },
  { path: path.join(electronDistPath, 'win-unpacked', 'AXION PDV.exe'), desc: 'ExecutÃƒÆ’Ã‚Â¡vel' }
];

electronFiles.forEach(({ path: filePath, desc }) => {
  checkFile(filePath, desc);
});

console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ 4. VERIFICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DE CONFIGURAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O\n');

// Verificar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do main.js
const mainJsPath = path.join(projectRoot, 'electron', 'main.js');
if (fs.existsSync(mainJsPath)) {
  const mainContent = fs.readFileSync(mainJsPath, 'utf8');
  
  console.log(`${mainContent.includes('loadFile') ? '?' : '?'} loadFile configurado`);
  console.log(`${mainContent.includes('dist/index.html') ? '?' : '?'} Path do index.html correto`);
  console.log(`${mainContent.includes('preload.js') ? '?' : '?'} Preload script configurado`);
  console.log(`${mainContent.includes('ipcMain.handle') ? '?' : '?'} IPC handlers configurados`);
  console.log(`${mainContent.includes('dataEngine') ? '?' : '?'} DataEngine configurado`);
  console.log(`${mainContent.includes('electron') ? '?' : '?'} Electron configurado`);
}

// Verificar configuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do preload.js
const preloadPath = path.join(projectRoot, 'electron', 'preload.js');
if (fs.existsSync(preloadPath)) {
  const preloadContent = fs.readFileSync(preloadPath, 'utf8');
  
  console.log(`${preloadContent.includes('contextBridge') ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} contextBridge configurado`);
  console.log(`${preloadContent.includes('dataEngine') ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} dataEngine exposto`);
  console.log(`${preloadContent.includes('ipcRenderer') ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} ipcRenderer configurado`);
}

console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ 5. VERIFICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DE DEPENDÃƒÆ’Ã…Â NCIAS\n');

// Verificar package.json
const packageJsonPath = path.join(projectRoot, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    console.log(`${packageJson.dependencies.react ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} React nas dependÃƒÆ’Ã‚Âªncias`);
    console.log(`${packageJson.dependencies['react-dom'] ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} React DOM nas dependÃƒÆ’Ã‚Âªncias`);
    console.log(`${packageJson.dependencies['react-router-dom'] ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} React Router nas dependÃƒÆ’Ã‚Âªncias`);
    console.log(`${packageJson.devDependencies.electron ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} Electron nas devDependencies`);
    console.log(`${packageJson.devDependencies.vite ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} Vite nas devDependencies`);
    
    if (!packageJson.dependencies.react || !packageJson.dependencies['react-dom']) {
      console.log('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â DependÃƒÆ’Ã‚Âªncias React faltando!');
    }
  } catch (error) {
    console.log(`ÃƒÂ¢Ã‚ÂÃ…â€™ Erro ao ler package.json: ${error.message}`);
  }
}

console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ 6. VERIFICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DE COMPONENTES REACT\n');

// Verificar componentes principais
const reactComponents = [
  { path: path.join(projectRoot, 'src/renderer/main.jsx'), desc: 'Main React entry' },
  { path: path.join(projectRoot, 'src/renderer/App.jsx'), desc: 'App component' },
  { path: path.join(projectRoot, 'src/renderer/components/layout/AppLayout.jsx'), desc: 'AppLayout' }
];

reactComponents.forEach(({ path: filePath, desc }) => {
  checkFile(filePath, desc);
});

console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ 7. ANÃƒÆ’Ã‚ÂLISE DE POSSÃƒÆ’Ã‚ÂVEIS CAUSAS\n');

console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â PossÃƒÆ’Ã‚Â­veis causas de tela branca:');
console.log('');

// AnÃƒÆ’Ã‚Â¡lise de problemas comuns
if (!allFilesExist) {
  console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ ARQUIVOS DE BUILD FALTANDO');
  console.log('   - Execute: npm run build');
  console.log('   - Verifique se o processo de build concluiu sem erros');
}

if (!fs.existsSync(path.join(distPath, 'index.html'))) {
  console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ HTML PRINCIPAL NÃƒÆ’Ã†â€™O ENCONTRADO');
  console.log('   - O Electron nÃƒÆ’Ã‚Â£o encontra o arquivo para carregar');
}

if (!fs.existsSync(path.join(distPath, 'assets', 'index-DVKlQ-mq.js'))) {
  console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ JAVASCRIPT PRINCIPAL NÃƒÆ’Ã†â€™O ENCONTRADO');
  console.log('   - React nÃƒÆ’Ã‚Â£o pode ser carregado');
  console.log('   - Verifique o build do Vite');
}

// Verificar se hÃƒÆ’Ã‚Â¡ erros de importaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o
const mainJsxPath = path.join(projectRoot, 'src/renderer/main.jsx');
if (fs.existsSync(mainJsxPath)) {
  const mainContent = fs.readFileSync(mainJsxPath, 'utf8');
  if (!mainContent.includes('createRoot')) {
    console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ createRoot nÃƒÆ’Ã‚Â£o encontrado no main.jsx');
    console.log('   - React 18 usa createRoot em vez de ReactDOM.render');
  }
}

console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ 8. RECOMENDAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES\n');

console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â§ SoluÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes possÃƒÆ’Ã‚Â­veis:');
console.log('');
console.log('1. ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾ REBUILD COMPLETO:');
console.log('   npm run clean:dist');
console.log('   npm run build');
console.log('   npm run electron:build');
console.log('');
console.log('2. ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â¦ VERIFICAR DEPENDÃƒÆ’Ã…Â NCIAS:');
console.log('   npm install');
console.log('   npm audit fix');
console.log('');
console.log('3. ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Âª TESTAR EM MODO DESENVOLVIMENTO:');
console.log('   npm run dev');
console.log('   Verifique o console do navegador');
console.log('');
console.log('4. ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â DEBUG DO ELECTRON:');
console.log('   Abra as DevTools no Electron');
console.log('   Verifique erros no console');
console.log('   Verifique a aba Network');
console.log('');
console.log('5. ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã‚Â VERIFICAR VARIÃƒÆ’Ã‚ÂVEIS DE AMBIENTE:');
console.log('   ENV_FILE=.env.production');
console.log('   Verifique se as variÃƒÆ’Ã‚Â¡veis estÃƒÆ’Ã‚Â£o corretas');

console.log('\nÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¯ DIAGNÃƒÆ’Ã¢â‚¬Å“STICO FINAL\n');

const criticalIssues = [];
if (!allFilesExist) criticalIssues.push('Arquivos de build faltando');
if (!fs.existsSync(path.join(distPath, 'index.html'))) criticalIssues.push('HTML principal ausente');
if (!fs.existsSync(path.join(distPath, 'assets', 'index-DVKlQ-mq.js'))) criticalIssues.push('JavaScript principal ausente');

if (criticalIssues.length === 0) {
  console.log('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ NENHUM PROBLEMA CRÃƒÆ’Ã‚ÂTICO DETECTADO');
  console.log('   - Todos os arquivos essenciais existem');
  console.log('   - Build parece estar correto');
  console.log('   - Problema pode ser em tempo de execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o');
  console.log('');
  console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â PrÃƒÆ’Ã‚Â³ximos passos:');
  console.log('   1. Execute o aplicativo em modo desenvolvimento');
  console.log('   2. Abra as DevTools');
  console.log('   3. Verifique erros no console');
  console.log('   4. Verifique se o React estÃƒÆ’Ã‚Â¡ sendo renderizado');
} else {
  console.log(`ÃƒÂ¢Ã‚ÂÃ…â€™ ${criticalIssues.length} PROBLEMAS CRÃƒÆ’Ã‚ÂTICOS DETECTADOS:`);
  criticalIssues.forEach(issue => console.log(`   - ${issue}`));
  console.log('');
  console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â§ Execute as correÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes recomendadas acima');
}

console.log('\nÃƒÂ°Ã…Â¸Ã…â€™Ã…Â¸ DiagnÃƒÆ’Ã‚Â³stico concluÃƒÆ’Ã‚Â­do!');
