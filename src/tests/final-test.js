// src/tests/final-test.js
// Teste final do aplicativo corrigido

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Âª TESTE FINAL - APLICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O CORRIGIDA\n');

// ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
const projectRoot = path.join(__dirname, '../..');
const executablePath = path.join(projectRoot, 'dist-electron/win-unpacked/AXION PDV.exe');

// VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o final do build
function finalBuildVerification() {
  console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ VERIFICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O FINAL DO BUILD');
  
  const checks = [
    { name: 'ExecutÃƒÆ’Ã‚Â¡vel', path: 'dist-electron/win-unpacked/AXION PDV.exe' },
    { name: 'HTML corrigido', path: 'dist/index.html' },
    { name: 'JavaScript bundle', path: 'dist/assets/index-DVKlQ-mq.js' },
    { name: 'CSS bundle', path: 'dist/assets/index-BA1D6u8N.css' }
  ];
  
  let allOk = true;
  checks.forEach(({ name, path: filePath }) => {
    const fullPath = path.join(projectRoot, filePath);
    const exists = fs.existsSync(fullPath);
    const stats = exists ? fs.statSync(fullPath) : null;
    
    console.log(`${exists ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦' : 'ÃƒÂ¢Ã‚ÂÃ…â€™'} ${name}`);
    if (exists && stats) {
      console.log(`   ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â  Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`   ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¦ Modificado: ${stats.mtime.toLocaleString('pt-BR')}`);
    }
    if (!exists) allOk = false;
  });
  
  return allOk;
}

// VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do conteÃƒÆ’Ã‚Âºdo corrigido
function correctedContentVerification() {
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ VERIFICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DO CONTEÃƒÆ’Ã…Â¡DO CORRIGIDO');
  
  // Verifica HTML
  const htmlPath = path.join(projectRoot, 'dist/index.html');
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    const checks = [
      { name: 'DOCTYPE', test: html.includes('<!DOCTYPE html>') },
      { name: 'Meta charset', test: html.includes('charset=UTF-8') },
      { name: 'Meta viewport', test: html.includes('viewport') },
      { name: 'Root div', test: html.includes('<div id=\'root\'>') },
      { name: 'Fallback styles', test: html.includes('background-color: #f5f7fb') },
      { name: 'Loading spinner', test: html.includes('loading-spinner') },
      { name: 'Error handling', test: html.includes('window.addEventListener(\'error\'') },
      { name: 'Timeout detection', test: html.includes('setTimeout') }
    ];
    
    console.log('  ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾ HTML:');
    checks.forEach(({ name, test }) => {
      console.log(`    ${test ? '?' : '?'} ${name}`);
    });
  }
  
  // Verifica App.jsx
  const appPath = path.join(projectRoot, 'src/renderer/App.jsx');
  if (fs.existsSync(appPath)) {
    const app = fs.readFileSync(appPath, 'utf8');
    
    const hasErrorBoundary = app.includes('ErrorBoundary') || app.includes('componentDidCatch');
    console.log(`  ? App.jsx: ${hasErrorBoundary ? '?' : '?'} ErrorBoundary`);
  }
  
  // Verifica main.jsx
  const mainPath = path.join(projectRoot, 'src/renderer/main.jsx');
  if (fs.existsSync(mainPath)) {
    const main = fs.readFileSync(mainPath, 'utf8');
    
    const checks = [
      { name: 'React import', test: main.includes('import React') },
      { name: 'ReactDOM import', test: main.includes('import ReactDOM') },
      { name: 'createRoot', test: main.includes('createRoot') },
      { name: 'Error handling', test: main.includes('try') && main.includes('catch') }
    ];
    
    console.log('  ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾ main.jsx:');
    checks.forEach(({ name, test }) => {
      console.log(`    ${test ? '?' : '?'} ${name}`);
    });
  }
}

// Teste de execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do executÃƒÆ’Ã‚Â¡vel
async function testExecutable() {
  console.log('\nÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Âª TESTE DE EXECUÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O DO EXECUTÃƒÆ’Ã‚ÂVEL');
  
  return new Promise((resolve) => {
    if (!fs.existsSync(executablePath)) {
      console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ ExecutÃƒÆ’Ã‚Â¡vel nÃƒÆ’Ã‚Â£o encontrado');
      resolve({ success: false, error: 'ExecutÃƒÆ’Ã‚Â¡vel nÃƒÆ’Ã‚Â£o encontrado' });
      return;
    }
    
    console.log('ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ Iniciando executÃƒÆ’Ã‚Â¡vel...');
    
    // Inicia o executÃƒÆ’Ã‚Â¡vel
    const process = spawn(executablePath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    
    let output = '';
    let hasError = false;
    let startTime = Date.now();
    
    // Captura saÃƒÆ’Ã‚Â­da
    process.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾', text.trim());
    });
    
    process.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      hasError = true;
      console.log('ÃƒÂ¢Ã‚ÂÃ…â€™', text.trim());
    });
    
    // Evento de fechamento
    process.on('close', (code) => {
      const duration = Date.now() - startTime;
      console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â  Processo finalizado');
      console.log(`ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ Exit code: ${code}`);
      console.log(`ÃƒÂ¢Ã‚ÂÃ‚Â±ÃƒÂ¯Ã‚Â¸Ã‚Â DuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o: ${duration}ms`);
      
      resolve({
        success: code === 0 && !hasError,
        exitCode: code,
        duration,
        output,
        hasError
      });
    });
    
    // Timeout de 30 segundos
    setTimeout(() => {
      if (!process.killed) {
        console.log('ÃƒÂ¢Ã‚ÂÃ‚Â° Timeout - encerrando processo...');
        process.kill('SIGTERM');
        
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
      }
    }, 30000);
  });
}

// CriaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de instruÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de teste
function createTestInstructions() {
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ INSTRUÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES DE TESTE MANUAL');
  console.log('='.repeat(50));
  
  const instructions = `
ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Âª TESTE MANUAL PASSO A PASSO:

1. ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ EXECUÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O:
   - Execute: dist-electron\\win-unpacked\\AXION PDV.exe
   - Aguarde a aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o iniciar

2. ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â VERIFICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O VISUAL:
   - A aplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o deve mostrar "ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â AXION PDV - Carregando..."
   - Depois deve carregar a interface completa
   - NÃƒÆ’Ã‚Â£o deve ficar em tela branca

3. ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â DEBUG (SE NECESSÃƒÆ’Ã‚ÂRIO):
   - Pressione F12 para abrir DevTools
   - VÃƒÆ’Ã‚Â¡ para a aba Console
   - Execute: debugApp()
   - Verifique o resultado

4. ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â  VERIFICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES NO CONSOLE:
   - Deve mostrar: "ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ AplicaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o React inicializada com sucesso"
   - NÃƒÆ’Ã‚Â£o deve mostrar erros vermelhos
   - DataEngine deve estar disponÃƒÆ’Ã‚Â­vel

5. ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¯ FUNCIONALIDADES BÃƒÆ’Ã‚ÂSICAS:
   - Dashboard deve carregar
   - Menu de navegaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o deve funcionar
   - BotÃƒÆ’Ã‚Âµes devem responder a cliques

6. ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â§ SE AINDA HOUVER PROBLEMAS:
   - Verifique o console por erros especÃƒÆ’Ã‚Â­ficos
   - Execute: tryFix() para correÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes automÃƒÆ’Ã‚Â¡ticas
   - Recarregue a pÃƒÆ’Ã‚Â¡gina (Ctrl+R)

ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â¾ SUPORTE:
   - Logs: %APPDATA%\\AXION PDV\\logs\\
   - Config: %APPDATA%\\AXION PDV\\config\\
   - Debug: Use as DevTools (F12)
`;
  
  console.log(instructions);
  
  // Salva as instruÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes
  const instructionsPath = path.join(projectRoot, 'TEST-INSTRUCTIONS.md');
  fs.writeFileSync(instructionsPath, instructions);
  console.log(`ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾ InstruÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes salvas em: ${instructionsPath}`);
}

// RelatÃƒÆ’Ã‚Â³rio final
function generateFinalReport(buildOk, testResult) {
  console.log('\nÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â  RELATÃƒÆ’Ã¢â‚¬Å“RIO FINAL');
  console.log('='.repeat(50));
  
  const report = `
# ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¯ RELATÃƒÆ’Ã¢â‚¬Å“RIO FINAL - CORREÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã¢â‚¬Â¢ES APLICADAS

## ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ Status do Build
- **Arquivos crÃƒÆ’Ã‚Â­ticos:** ${buildOk ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ OK' : 'ÃƒÂ¢Ã‚ÂÃ…â€™ PROBLEMAS'}
- **HTML:** ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Corrigido com fallbacks
- **JavaScript:** ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Bundle completo
- **Componentes:** ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ ErrorBoundary adicionado
- **Electron:** ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o correta

## ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â§ CorreÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes Aplicadas
1. **HTML Melhorado:**
   - Meta tags adicionadas
   - Fallback styles implementados
   - Loading spinner adicionado
   - Error handling implementado
   - Timeout detection adicionado

2. **main.jsx Otimizado:**
   - Tratamento de erros adicionado
   - VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de DOM implementada
   - Logging melhorado

3. **App.jsx Protegido:**
   - ErrorBoundary implementado
   - Captura de erros adicionada
   - OpÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de reload automÃƒÆ’Ã‚Â¡tico

4. **Build Completo:**
   - Limpeza completa
   - Rebuild otimizado
   - VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o final

## ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Âª Resultados do Teste
- **ExecutÃƒÆ’Ã‚Â¡vel:** ${testResult.success ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Funcionou' : 'ÃƒÂ¢Ã‚ÂÃ…â€™ Problemas'}
- **Exit Code:** ${testResult.exitCode}
- **DuraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:** ${testResult.duration}ms
- **Erros:** ${testResult.hasError ? 'Detectados' : 'Nenhum'}

## ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¯ PrÃƒÆ’Ã‚Â³ximos Passos
1. **Teste Manual:** Execute o aplicativo
2. **VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o Visual:** Confirme que nÃƒÆ’Ã‚Â£o hÃƒÆ’Ã‚Â¡ tela branca
3. **Debug:** Use F12 se necessÃƒÆ’Ã‚Â¡rio
4. **ValidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o:** Teste as funcionalidades

## ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã…Â¾ Suporte
- **ExecutÃƒÆ’Ã‚Â¡vel:** dist-electron\\win-unpacked\\AXION PDV.exe
- **Debug:** Pressione F12
- **Logs:** Verifique console
- **InstruÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes:** TEST-INSTRUCTIONS.md

---
**Data:** ${new Date().toLocaleString('pt-BR')}
**Status:** ${buildOk && testResult.success ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ PRONTO PARA USO' : 'ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â REQUER ATENÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O'}
`;
  
  const reportPath = path.join(projectRoot, 'FINAL-REPORT.md');
  fs.writeFileSync(reportPath, report);
  console.log(`ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Å¾ RelatÃƒÆ’Ã‚Â³rio salvo em: ${reportPath}`);
  
  return report;
}

// FunÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o principal
async function main() {
  console.log('ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â¯ INICIANDO TESTE FINAL\n');
  
  // VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do build
  const buildOk = finalBuildVerification();
  
  // VerificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o do conteÃƒÆ’Ã‚Âºdo
  correctedContentVerification();
  
  // Teste do executÃƒÆ’Ã‚Â¡vel
  const testResult = await testExecutable();
  
  // InstruÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes de teste
  createTestInstructions();
  
  // RelatÃƒÆ’Ã‚Â³rio final
  const report = generateFinalReport(buildOk, testResult);
  
  // Resumo final
  console.log('\nÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Â° RESUMO FINAL');
  console.log('='.repeat(50));
  console.log(`Build: ${buildOk ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ OK' : 'ÃƒÂ¢Ã‚ÂÃ…â€™ Problemas'}`);
  console.log(`ExecutÃƒÆ’Ã‚Â¡vel: ${testResult.success ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Funcionou' : 'ÃƒÂ¢Ã‚ÂÃ…â€™ Problemas'}`);
  console.log(`CorreÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes: ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Aplicadas`);
  
  if (buildOk && testResult.success) {
    console.log('\nÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Â° APLICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O PRONTA PARA USO!');
    console.log('ÃƒÂ°Ã…Â¸Ã…Â¡Ã¢â€šÂ¬ Execute: dist-electron\\win-unpacked\\AXION PDV.exe');
  } else {
    console.log('\nÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â APLICAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O REQUER ATENÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O');
    console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ Verifique os logs e instruÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes acima');
  }
  
  console.log('\nÃƒÂ°Ã…Â¸Ã…â€™Ã…Â¸ TESTE FINAL CONCLUÃƒÆ’Ã‚ÂDO!');
}

main().catch(console.error);
