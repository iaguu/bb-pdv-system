// src/tests/simple-debug.js
// Debug simples do problema de tela branca

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â DEBUG SIMPLES - TELA BRANCA\n');

// ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
const projectRoot = path.join(__dirname, '../..');

// VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o bÃƒÆ’Ã‚Â¡sica
function basicCheck() {
  console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ VERIFICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O BÃƒÆ’Ã‚ÂSICA\n');
  
  // Verifica arquivos crÃƒÆ’Ã‚Â­ticos
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
    console.log(`${exists ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} ${file}`);
    if (!exists) allExist = false;
  });
  
  return allExist;
}

// VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do conteÃƒÆ’Ã‚Âºdo HTML
function checkHtmlContent() {
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ VERIFICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DO HTML\n');
  
  const htmlPath = path.join(projectRoot, 'dist/index.html');
  if (!fs.existsSync(htmlPath)) {
    console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ HTML nÃƒÆ’Ã‚Â£o encontrado');
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
    console.log(`${test ? '?' : '?'} ${name}`);
  });
  
  return checks.every(c => c.test);
}

// VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do JavaScript
function checkJsContent() {
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ VERIFICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DO JAVASCRIPT\n');
  
  const jsPath = path.join(projectRoot, 'dist/assets/index-DVKlQ-mq.js');
  if (!fs.existsSync(jsPath)) {
    console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ JavaScript nÃƒÆ’Ã‚Â£o encontrado');
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
    console.log(`${test ? '?' : '?'} ${name}`);
  });
  
  return checks.every(c => c.test);
}

// Teste de execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do Electron
async function testElectronExecution() {
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ TESTE DE EXECUÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DO ELECTRON\n');
  
  return new Promise((resolve) => {
    console.log('ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ Tentando executar em modo dev...');
    
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
      console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾', text.trim());
      
      if (text.includes('ready') || text.includes('started') || text.includes('loaded')) {
        hasSuccess = true;
      }
    });
    
    electronProcess.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      hasError = true;
      console.log('ÃƒÂ¢Ã‚ÂÃ…â€™', text.trim());
    });
    
    electronProcess.on('close', (code) => {
      console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â  Processo finalizado com cÃƒÆ’Ã‚Â³digo:', code);
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

// AnÃƒÆ’Ã‚Â¡lise do problema
function analyzeProblem(basicOk, htmlOk, jsOk, electronResult) {
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ ANÃƒÆ’Ã‚ÂLISE DO PROBLEMA\n');
  
  console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â Resultados:');
  console.log(`   Arquivos bÃƒÆ’Ã‚Â¡sicos: ${basicOk ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'}`);
  console.log(`   HTML: ${htmlOk ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'}`);
  console.log(`   JavaScript: ${jsOk ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'}`);
  console.log(`   ExecuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o: ${electronResult.hasError ? 'ÃƒÂ¢Ã‚ÂÃ…â€™' : 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦'} (cÃƒÆ’Ã‚Â³digo: ${electronResult.exitCode})`);
  
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â DiagnÃƒÆ’Ã‚Â³stico:');
  
  if (!basicOk) {
    console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ PROBLEMA: Arquivos crÃƒÆ’Ã‚Â­ticos faltando');
    console.log('   SoluÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o: Execute npm run build');
  } else if (!htmlOk) {
    console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ PROBLEMA: HTML malformado');
    console.log('   SoluÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o: Verifique o build do Vite');
  } else if (!jsOk) {
    console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ PROBLEMA: JavaScript bundle incompleto');
    console.log('   SoluÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o: Verifique dependÃƒÆ’Ã‚Âªncias e build');
  } else if (electronResult.hasError) {
    console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ PROBLEMA: Erro na execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do Electron');
    console.log('   Verifique o stderr acima para detalhes');
  } else if (!electronResult.hasSuccess) {
    console.log('ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â PROBLEMA: AplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o nÃƒÆ’Ã‚Â£o iniciou corretamente');
    console.log('   PossÃƒÆ’Ã‚Â­vel causa: React nÃƒÆ’Ã‚Â£o estÃƒÆ’Ã‚Â¡ renderizando');
  } else {
    console.log('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ NENHUM PROBLEMA DETECTADO');
    console.log('   Se ainda hÃƒÆ’Ã‚Â¡ tela branca, verifique as DevTools');
  }
  
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ RECOMENDAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES\n');
  
  if (basicOk && htmlOk && jsOk) {
    console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â§ PrÃƒÆ’Ã‚Â³ximos passos:');
    console.log('1. Abra as DevTools no Electron (F12)');
    console.log('2. Verifique erros no console');
    console.log('3. Verifique se o elemento #root tem conteÃƒÆ’Ã‚Âºdo');
    console.log('4. Verifique se hÃƒÆ’Ã‚Â¡ erros de CSS');
    console.log('5. Verifique se hÃƒÆ’Ã‚Â¡ problemas de carregamento de recursos');
  } else {
    console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â§ CorreÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes necessÃƒÆ’Ã‚Â¡rias:');
    console.log('1. npm run clean:dist');
    console.log('2. npm install');
    console.log('3. npm run build');
    console.log('4. npm run electron:build');
  }
}

// FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o principal
async function main() {
  console.log('ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¯ INICIANDO DEBUG SIMPLES\n');
  
  const basicOk = basicCheck();
  const htmlOk = checkHtmlContent();
  const jsOk = checkJsContent();
  const electronResult = await testElectronExecution();
  
  analyzeProblem(basicOk, htmlOk, jsOk, electronResult);
  
  console.log('\nÃƒÂ°Ã…Â¸Ã…â€™Ã…Â¸ DEBUG CONCLUÃƒÆ’Ã‚ÂDO!');
}

main().catch(console.error);
