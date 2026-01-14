// src/tests/simple-debug.js
// Debug simples do problema de tela branca

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔍 DEBUG SIMPLES - TELA BRANCA\n');

// Configurações
const projectRoot = path.join(__dirname, '../..');

// Verificação básica
function basicCheck() {
  console.log('📋 VERIFICAÇÃO BÁSICA\n');
  
  // Verifica arquivos críticos
  const files = [
    'dist/index.html',
    'dist/assets/index-DVKlQ-mq.js',
    'dist/assets/index-BA1D6u8N.css',
    'electron/main.js',
    'electron/preload.js'
  ];
  
  let allExist = true;
  files.forEach(file => {
    const filePath = path.join(projectRoot, file);
    const exists = fs.existsSync(filePath);
    console.log(`${exists  '✅' : '❌'} ${file}`);
    if (!exists) allExist = false;
  });
  
  return allExist;
}

// Verificação do conteúdo HTML
function checkHtmlContent() {
  console.log('\n📋 VERIFICAÇÃO DO HTML\n');
  
  const htmlPath = path.join(projectRoot, 'dist/index.html');
  if (!fs.existsSync(htmlPath)) {
    console.log('❌ HTML não encontrado');
    return false;
  }
  
  const html = fs.readFileSync(htmlPath, 'utf8');
  const checks = [
    { name: 'DOCTYPE', test: html.includes('<!DOCTYPE html>') },
    { name: 'Root div', test: html.includes('<div id=\'root\'>') },
    { name: 'Script tag', test: html.includes('<script') },
    { name: 'JS bundle', test: html.includes('index-DVKlQ-mq.js') },
    { name: 'CSS link', test: html.includes('index-BA1D6u8N.css') }
  ];
  
  checks.forEach(({ name, test }) => {
    console.log(`${test  '✅' : '❌'} ${name}`);
  });
  
  return checks.every(c => c.test);
}

// Verificação do JavaScript
function checkJsContent() {
  console.log('\n📋 VERIFICAÇÃO DO JAVASCRIPT\n');
  
  const jsPath = path.join(projectRoot, 'dist/assets/index-DVKlQ-mq.js');
  if (!fs.existsSync(jsPath)) {
    console.log('❌ JavaScript não encontrado');
    return false;
  }
  
  const js = fs.readFileSync(jsPath, 'utf8');
  const checks = [
    { name: 'React', test: js.includes('react') || js.includes('React') },
    { name: 'ReactDOM', test: js.includes('react-dom') || js.includes('ReactDOM') },
    { name: 'createRoot', test: js.includes('createRoot') },
    { name: 'App', test: js.includes('App') },
    { name: 'Router', test: js.includes('react-router') || js.includes('BrowserRouter') || js.includes('HashRouter') }
  ];
  
  checks.forEach(({ name, test }) => {
    console.log(`${test  '✅' : '❌'} ${name}`);
  });
  
  return checks.every(c => c.test);
}

// Teste de execução do Electron
async function testElectronExecution() {
  console.log('\n📋 TESTE DE EXECUÇÃO DO ELECTRON\n');
  
  return new Promise((resolve) => {
    console.log('🚀 Tentando executar em modo dev...');
    
    const electronProcess = spawn('cmd', ['/c', `cd "${projectRoot}" && set ENV_FILE=.env.production&& electron .`], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      timeout: 10000
    });
    
    let output = '';
    let hasError = false;
    let hasSuccess = false;
    
    electronProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('📄', text.trim());
      
      if (text.includes('ready') || text.includes('started') || text.includes('loaded')) {
        hasSuccess = true;
      }
    });
    
    electronProcess.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      hasError = true;
      console.log('❌', text.trim());
    });
    
    electronProcess.on('close', (code) => {
      console.log('📊 Processo finalizado com código:', code);
      resolve({
        exitCode: code,
        output,
        hasError,
        hasSuccess
      });
    });
    
    setTimeout(() => {
      if (!electronProcess.killed) {
        electronProcess.kill('SIGTERM');
      }
    }, 10000);
  });
}

// Análise do problema
function analyzeProblem(basicOk, htmlOk, jsOk, electronResult) {
  console.log('\n📋 ANÁLISE DO PROBLEMA\n');
  
  console.log('🔍 Resultados:');
  console.log(`   Arquivos básicos: ${basicOk  '✅' : '❌'}`);
  console.log(`   HTML: ${htmlOk  '✅' : '❌'}`);
  console.log(`   JavaScript: ${jsOk  '✅' : '❌'}`);
  console.log(`   Execução: ${electronResult.hasError  '❌' : '✅'} (código: ${electronResult.exitCode})`);
  
  console.log('\n🔍 Diagnóstico:');
  
  if (!basicOk) {
    console.log('❌ PROBLEMA: Arquivos críticos faltando');
    console.log('   Solução: Execute npm run build');
  } else if (!htmlOk) {
    console.log('❌ PROBLEMA: HTML malformado');
    console.log('   Solução: Verifique o build do Vite');
  } else if (!jsOk) {
    console.log('❌ PROBLEMA: JavaScript bundle incompleto');
    console.log('   Solução: Verifique dependências e build');
  } else if (electronResult.hasError) {
    console.log('❌ PROBLEMA: Erro na execução do Electron');
    console.log('   Verifique o stderr acima para detalhes');
  } else if (!electronResult.hasSuccess) {
    console.log('⚠️ PROBLEMA: Aplicação não iniciou corretamente');
    console.log('   Possível causa: React não está renderizando');
  } else {
    console.log('✅ NENHUM PROBLEMA DETECTADO');
    console.log('   Se ainda há tela branca, verifique as DevTools');
  }
  
  console.log('\n📋 RECOMENDAÇÕES\n');
  
  if (basicOk && htmlOk && jsOk) {
    console.log('🔧 Próximos passos:');
    console.log('1. Abra as DevTools no Electron (F12)');
    console.log('2. Verifique erros no console');
    console.log('3. Verifique se o elemento #root tem conteúdo');
    console.log('4. Verifique se há erros de CSS');
    console.log('5. Verifique se há problemas de carregamento de recursos');
  } else {
    console.log('🔧 Correções necessárias:');
    console.log('1. npm run clean:dist');
    console.log('2. npm install');
    console.log('3. npm run build');
    console.log('4. npm run electron:build');
  }
}

// Função principal
async function main() {
  console.log('🎯 INICIANDO DEBUG SIMPLES\n');
  
  const basicOk = basicCheck();
  const htmlOk = checkHtmlContent();
  const jsOk = checkJsContent();
  const electronResult = await testElectronExecution();
  
  analyzeProblem(basicOk, htmlOk, jsOk, electronResult);
  
  console.log('\n🌟 DEBUG CONCLUÍDO!');
}

main().catch(console.error);
