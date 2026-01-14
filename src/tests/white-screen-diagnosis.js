// src/tests/white-screen-diagnosis.js
// Diagnóstico completo do problema de tela branca

const fs = require('fs');
const path = require('path');

console.log('🔍 DIAGNÓSTICO COMPLETO - TELA BRANCA\n');

// Configurações
const projectRoot = path.join(__dirname, '../..');
const distPath = path.join(projectRoot, 'dist');
const electronDistPath = path.join(projectRoot, 'dist-electron');

// Função auxiliar para verificar arquivos
function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  const stats = exists  fs.statSync(filePath) : null;
  
  console.log(`${exists  '✅' : '❌'} ${description}`);
  if (exists && stats) {
    console.log(`   📁 Path: ${filePath}`);
    console.log(`   📊 Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`   📅 Modified: ${stats.mtime.toLocaleString('pt-BR')}`);
  } else if (!exists) {
    console.log(`   ❌ Arquivo não encontrado: ${filePath}`);
  }
  return exists;
}

// Função para verificar conteúdo de arquivos críticos
function checkFileContent(filePath, criticalStrings = []) {
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Arquivo não existe: ${filePath}`);
    return false;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const missingStrings = criticalStrings.filter(str => !content.includes(str));
    
    if (missingStrings.length === 0) {
      console.log(`✅ Conteúdo crítico OK: ${path.basename(filePath)}`);
      return true;
    } else {
      console.log(`❌ Conteúdo crítico faltando em ${path.basename(filePath)}:`);
      missingStrings.forEach(str => console.log(`   - "${str}"`));
      return false;
    }
  } catch (error) {
    console.log(`❌ Erro ao ler ${path.basename(filePath)}: ${error.message}`);
    return false;
  }
}

console.log('📋 1. VERIFICAÇÃO DE ARQUIVOS CRÍTICOS\n');

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

console.log('\n📋 2. VERIFICAÇÃO DE CONTEÚDO CRÍTICO\n');

// Verificar conteúdo do HTML
checkFileContent(
  path.join(distPath, 'index.html'),
  ['<!DOCTYPE html>', '<div id=\'root\'>', '<script', 'index-DVKlQ-mq.js']
);

// Verificar se o JavaScript tem o conteúdo React
const jsPath = path.join(distPath, 'assets', 'index-DVKlQ-mq.js');
if (fs.existsSync(jsPath)) {
  try {
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    const hasReact = jsContent.includes('react') || jsContent.includes('React');
    const hasReactDOM = jsContent.includes('react-dom') || jsContent.includes('ReactDOM');
    const hasCreateRoot = jsContent.includes('createRoot');
    const hasApp = jsContent.includes('App');
    
    console.log(`${hasReact  '✅' : '❌'} React encontrado no bundle`);
    console.log(`${hasReactDOM  '✅' : '❌'} ReactDOM encontrado no bundle`);
    console.log(`${hasCreateRoot  '✅' : '❌'} createRoot encontrado no bundle`);
    console.log(`${hasApp  '✅' : '❌'} App component encontrado no bundle`);
    
    if (!hasReact || !hasReactDOM || !hasCreateRoot) {
      console.log('⚠️ Possível problema no bundle do JavaScript');
    }
  } catch (error) {
    console.log(`❌ Erro ao analisar JavaScript: ${error.message}`);
  }
}

console.log('\n📋 3. VERIFICAÇÃO DO ELECTRON\n');

// Verificar arquivos do Electron
const electronFiles = [
  { path: path.join(projectRoot, 'electron', 'main.js'), desc: 'Main process' },
  { path: path.join(projectRoot, 'electron', 'preload.js'), desc: 'Preload script' },
  { path: path.join(projectRoot, 'electron', 'db.js'), desc: 'Database layer' },
  { path: path.join(electronDistPath, 'win-unpacked', 'AXION PDV.exe'), desc: 'Executável' }
];

electronFiles.forEach(({ path: filePath, desc }) => {
  checkFile(filePath, desc);
});

console.log('\n📋 4. VERIFICAÇÃO DE CONFIGURAÇÃO\n');

// Verificar configuração do main.js
const mainJsPath = path.join(projectRoot, 'electron', 'main.js');
if (fs.existsSync(mainJsPath)) {
  const mainContent = fs.readFileSync(mainJsPath, 'utf8');
  
  console.log(`${mainContent.includes('loadFile')  '✅' : '❌'} loadFile configurado`);
  console.log(`${mainContent.includes('dist/index.html')  '✅' : '❌'} Path do index.html correto`);
  console.log(`${mainContent.includes('preload.js')  '✅' : '❌'} Preload script configurado`);
  console.log(`${mainContent.includes('ipcMain.handle')  '✅' : '❌'} IPC handlers configurados`);
  console.log(`${mainContent.includes('dataEngine')  '✅' : '❌'} DataEngine configurado`);
  console.log(`${mainContent.includes('electron')  '✅' : '❌'} Electron configurado`);
}

// Verificar configuração do preload.js
const preloadPath = path.join(projectRoot, 'electron', 'preload.js');
if (fs.existsSync(preloadPath)) {
  const preloadContent = fs.readFileSync(preloadPath, 'utf8');
  
  console.log(`${preloadContent.includes('contextBridge')  '✅' : '❌'} contextBridge configurado`);
  console.log(`${preloadContent.includes('dataEngine')  '✅' : '❌'} dataEngine exposto`);
  console.log(`${preloadContent.includes('ipcRenderer')  '✅' : '❌'} ipcRenderer configurado`);
}

console.log('\n📋 5. VERIFICAÇÃO DE DEPENDÊNCIAS\n');

// Verificar package.json
const packageJsonPath = path.join(projectRoot, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    console.log(`${packageJson.dependencies.react  '✅' : '❌'} React nas dependências`);
    console.log(`${packageJson.dependencies.['react-dom']  '✅' : '❌'} React DOM nas dependências`);
    console.log(`${packageJson.dependencies.['react-router-dom']  '✅' : '❌'} React Router nas dependências`);
    console.log(`${packageJson.devDependencies.electron  '✅' : '❌'} Electron nas devDependencies`);
    console.log(`${packageJson.devDependencies.vite  '✅' : '❌'} Vite nas devDependencies`);
    
    if (!packageJson.dependencies.react || !packageJson.dependencies.['react-dom']) {
      console.log('⚠️ Dependências React faltando!');
    }
  } catch (error) {
    console.log(`❌ Erro ao ler package.json: ${error.message}`);
  }
}

console.log('\n📋 6. VERIFICAÇÃO DE COMPONENTES REACT\n');

// Verificar componentes principais
const reactComponents = [
  { path: path.join(projectRoot, 'src/renderer/main.jsx'), desc: 'Main React entry' },
  { path: path.join(projectRoot, 'src/renderer/App.jsx'), desc: 'App component' },
  { path: path.join(projectRoot, 'src/renderer/components/layout/AppLayout.jsx'), desc: 'AppLayout' }
];

reactComponents.forEach(({ path: filePath, desc }) => {
  checkFile(filePath, desc);
});

console.log('\n📋 7. ANÁLISE DE POSSÍVEIS CAUSAS\n');

console.log('🔍 Possíveis causas de tela branca:');
console.log('');

// Análise de problemas comuns
if (!allFilesExist) {
  console.log('❌ ARQUIVOS DE BUILD FALTANDO');
  console.log('   - Execute: npm run build');
  console.log('   - Verifique se o processo de build concluiu sem erros');
}

if (!fs.existsSync(path.join(distPath, 'index.html'))) {
  console.log('❌ HTML PRINCIPAL NÃO ENCONTRADO');
  console.log('   - O Electron não encontra o arquivo para carregar');
}

if (!fs.existsSync(path.join(distPath, 'assets', 'index-DVKlQ-mq.js'))) {
  console.log('❌ JAVASCRIPT PRINCIPAL NÃO ENCONTRADO');
  console.log('   - React não pode ser carregado');
  console.log('   - Verifique o build do Vite');
}

// Verificar se há erros de importação
const mainJsxPath = path.join(projectRoot, 'src/renderer/main.jsx');
if (fs.existsSync(mainJsxPath)) {
  const mainContent = fs.readFileSync(mainJsxPath, 'utf8');
  if (!mainContent.includes('createRoot')) {
    console.log('❌ createRoot não encontrado no main.jsx');
    console.log('   - React 18 usa createRoot em vez de ReactDOM.render');
  }
}

console.log('\n📋 8. RECOMENDAÇÕES\n');

console.log('🔧 Soluções possíveis:');
console.log('');
console.log('1. 🔄 REBUILD COMPLETO:');
console.log('   npm run clean:dist');
console.log('   npm run build');
console.log('   npm run electron:build');
console.log('');
console.log('2. 📦 VERIFICAR DEPENDÊNCIAS:');
console.log('   npm install');
console.log('   npm audit fix');
console.log('');
console.log('3. 🧪 TESTAR EM MODO DESENVOLVIMENTO:');
console.log('   npm run dev');
console.log('   Verifique o console do navegador');
console.log('');
console.log('4. 🔍 DEBUG DO ELECTRON:');
console.log('   Abra as DevTools no Electron');
console.log('   Verifique erros no console');
console.log('   Verifique a aba Network');
console.log('');
console.log('5. 📝 VERIFICAR VARIÁVEIS DE AMBIENTE:');
console.log('   ENV_FILE=.env.production');
console.log('   Verifique se as variáveis estão corretas');

console.log('\n🎯 DIAGNÓSTICO FINAL\n');

const criticalIssues = [];
if (!allFilesExist) criticalIssues.push('Arquivos de build faltando');
if (!fs.existsSync(path.join(distPath, 'index.html'))) criticalIssues.push('HTML principal ausente');
if (!fs.existsSync(path.join(distPath, 'assets', 'index-DVKlQ-mq.js'))) criticalIssues.push('JavaScript principal ausente');

if (criticalIssues.length === 0) {
  console.log('✅ NENHUM PROBLEMA CRÍTICO DETECTADO');
  console.log('   - Todos os arquivos essenciais existem');
  console.log('   - Build parece estar correto');
  console.log('   - Problema pode ser em tempo de execução');
  console.log('');
  console.log('🔍 Próximos passos:');
  console.log('   1. Execute o aplicativo em modo desenvolvimento');
  console.log('   2. Abra as DevTools');
  console.log('   3. Verifique erros no console');
  console.log('   4. Verifique se o React está sendo renderizado');
} else {
  console.log(`❌ ${criticalIssues.length} PROBLEMAS CRÍTICOS DETECTADOS:`);
  criticalIssues.forEach(issue => console.log(`   - ${issue}`));
  console.log('');
  console.log('🔧 Execute as correções recomendadas acima');
}

console.log('\n🌟 Diagnóstico concluído!');
