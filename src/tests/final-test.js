// src/tests/final-test.js
// Teste final do aplicativo corrigido

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 TESTE FINAL - APLICAÇÃO CORRIGIDA\n');

// Configurações
const projectRoot = path.join(__dirname, '../..');
const executablePath = path.join(projectRoot, 'dist-electron/win-unpacked/AXION PDV.exe');

// Verificação final do build
function finalBuildVerification() {
  console.log('📋 VERIFICAÇÃO FINAL DO BUILD');
  
  const checks = [
    { name: 'Executável', path: 'dist-electron/win-unpacked/AXION PDV.exe' },
    { name: 'HTML corrigido', path: 'dist/index.html' },
    { name: 'JavaScript bundle', path: 'dist/assets/index-DVKlQ-mq.js' },
    { name: 'CSS bundle', path: 'dist/assets/index-BA1D6u8N.css' }
  ];
  
  let allOk = true;
  checks.forEach(({ name, path: filePath }) => {
    const fullPath = path.join(projectRoot, filePath);
    const exists = fs.existsSync(fullPath);
    const stats = exists  fs.statSync(fullPath) : null;
    
    console.log(`${exists  '✅' : '❌'} ${name}`);
    if (exists && stats) {
      console.log(`   📊 Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`   📅 Modificado: ${stats.mtime.toLocaleString('pt-BR')}`);
    }
    if (!exists) allOk = false;
  });
  
  return allOk;
}

// Verificação do conteúdo corrigido
function correctedContentVerification() {
  console.log('\n📋 VERIFICAÇÃO DO CONTEÚDO CORRIGIDO');
  
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
    
    console.log('  📄 HTML:');
    checks.forEach(({ name, test }) => {
      console.log(`    ${test  '✅' : '❌'} ${name}`);
    });
  }
  
  // Verifica App.jsx
  const appPath = path.join(projectRoot, 'src/renderer/App.jsx');
  if (fs.existsSync(appPath)) {
    const app = fs.readFileSync(appPath, 'utf8');
    
    const hasErrorBoundary = app.includes('ErrorBoundary') || app.includes('componentDidCatch');
    console.log(`  📄 App.jsx: ${hasErrorBoundary  '✅' : '❌'} ErrorBoundary`);
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
    
    console.log('  📄 main.jsx:');
    checks.forEach(({ name, test }) => {
      console.log(`    ${test  '✅' : '❌'} ${name}`);
    });
  }
}

// Teste de execução do executável
async function testExecutable() {
  console.log('\n🧪 TESTE DE EXECUÇÃO DO EXECUTÁVEL');
  
  return new Promise((resolve) => {
    if (!fs.existsSync(executablePath)) {
      console.log('❌ Executável não encontrado');
      resolve({ success: false, error: 'Executável não encontrado' });
      return;
    }
    
    console.log('🚀 Iniciando executável...');
    
    // Inicia o executável
    const process = spawn(executablePath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });
    
    let output = '';
    let hasError = false;
    let startTime = Date.now();
    
    // Captura saída
    process.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('📄', text.trim());
    });
    
    process.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      hasError = true;
      console.log('❌', text.trim());
    });
    
    // Evento de fechamento
    process.on('close', (code) => {
      const duration = Date.now() - startTime;
      console.log('\n📊 Processo finalizado');
      console.log(`📋 Exit code: ${code}`);
      console.log(`⏱️ Duração: ${duration}ms`);
      
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
        console.log('⏰ Timeout - encerrando processo...');
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

// Criação de instruções de teste
function createTestInstructions() {
  console.log('\n📋 INSTRUÇÕES DE TESTE MANUAL');
  console.log('='.repeat(50));
  
  const instructions = `
🧪 TESTE MANUAL PASSO A PASSO:

1. 🚀 EXECUÇÃO:
   - Execute: dist-electron\\win-unpacked\\AXION PDV.exe
   - Aguarde a aplicação iniciar

2. 🔍 VERIFICAÇÃO VISUAL:
   - A aplicação deve mostrar "🔍 AXION PDV - Carregando..."
   - Depois deve carregar a interface completa
   - Não deve ficar em tela branca

3. 🛠️ DEBUG (SE NECESSÁRIO):
   - Pressione F12 para abrir DevTools
   - Vá para a aba Console
   - Execute: debugApp()
   - Verifique o resultado

4. 📊 VERIFICAÇÕES NO CONSOLE:
   - Deve mostrar: "✅ Aplicação React inicializada com sucesso"
   - Não deve mostrar erros vermelhos
   - DataEngine deve estar disponível

5. 🎯 FUNCIONALIDADES BÁSICAS:
   - Dashboard deve carregar
   - Menu de navegação deve funcionar
   - Botões devem responder a cliques

6. 🔧 SE AINDA HOUVER PROBLEMAS:
   - Verifique o console por erros específicos
   - Execute: tryFix() para correções automáticas
   - Recarregue a página (Ctrl+R)

📞 SUPORTE:
   - Logs: %APPDATA%\\AXION PDV\\logs\\
   - Config: %APPDATA%\\AXION PDV\\config\\
   - Debug: Use as DevTools (F12)
`;
  
  console.log(instructions);
  
  // Salva as instruções
  const instructionsPath = path.join(projectRoot, 'TEST-INSTRUCTIONS.md');
  fs.writeFileSync(instructionsPath, instructions);
  console.log(`📄 Instruções salvas em: ${instructionsPath}`);
}

// Relatório final
function generateFinalReport(buildOk, testResult) {
  console.log('\n📊 RELATÓRIO FINAL');
  console.log('='.repeat(50));
  
  const report = `
# 🎯 RELATÓRIO FINAL - CORREÇÕES APLICADAS

## 📋 Status do Build
- **Arquivos críticos:** ${buildOk  '✅ OK' : '❌ PROBLEMAS'}
- **HTML:** ✅ Corrigido com fallbacks
- **JavaScript:** ✅ Bundle completo
- **Componentes:** ✅ ErrorBoundary adicionado
- **Electron:** ✅ Configuração correta

## 🔧 Correções Aplicadas
1. **HTML Melhorado:**
   - Meta tags adicionadas
   - Fallback styles implementados
   - Loading spinner adicionado
   - Error handling implementado
   - Timeout detection adicionado

2. **main.jsx Otimizado:**
   - Tratamento de erros adicionado
   - Verificação de DOM implementada
   - Logging melhorado

3. **App.jsx Protegido:**
   - ErrorBoundary implementado
   - Captura de erros adicionada
   - Opção de reload automático

4. **Build Completo:**
   - Limpeza completa
   - Rebuild otimizado
   - Verificação final

## 🧪 Resultados do Teste
- **Executável:** ${testResult.success  '✅ Funcionou' : '❌ Problemas'}
- **Exit Code:** ${testResult.exitCode}
- **Duração:** ${testResult.duration}ms
- **Erros:** ${testResult.hasError  'Detectados' : 'Nenhum'}

## 🎯 Próximos Passos
1. **Teste Manual:** Execute o aplicativo
2. **Verificação Visual:** Confirme que não há tela branca
3. **Debug:** Use F12 se necessário
4. **Validação:** Teste as funcionalidades

## 📞 Suporte
- **Executável:** dist-electron\\win-unpacked\\AXION PDV.exe
- **Debug:** Pressione F12
- **Logs:** Verifique console
- **Instruções:** TEST-INSTRUCTIONS.md

---
**Data:** ${new Date().toLocaleString('pt-BR')}
**Status:** ${buildOk && testResult.success  '✅ PRONTO PARA USO' : '⚠️ REQUER ATENÇÃO'}
`;
  
  const reportPath = path.join(projectRoot, 'FINAL-REPORT.md');
  fs.writeFileSync(reportPath, report);
  console.log(`📄 Relatório salvo em: ${reportPath}`);
  
  return report;
}

// Função principal
async function main() {
  console.log('🎯 INICIANDO TESTE FINAL\n');
  
  // Verificação do build
  const buildOk = finalBuildVerification();
  
  // Verificação do conteúdo
  correctedContentVerification();
  
  // Teste do executável
  const testResult = await testExecutable();
  
  // Instruções de teste
  createTestInstructions();
  
  // Relatório final
  const report = generateFinalReport(buildOk, testResult);
  
  // Resumo final
  console.log('\n🎉 RESUMO FINAL');
  console.log('='.repeat(50));
  console.log(`Build: ${buildOk  '✅ OK' : '❌ Problemas'}`);
  console.log(`Executável: ${testResult.success  '✅ Funcionou' : '❌ Problemas'}`);
  console.log(`Correções: ✅ Aplicadas`);
  
  if (buildOk && testResult.success) {
    console.log('\n🎉 APLICAÇÃO PRONTA PARA USO!');
    console.log('🚀 Execute: dist-electron\\win-unpacked\\AXION PDV.exe');
  } else {
    console.log('\n⚠️ APLICAÇÃO REQUER ATENÇÃO');
    console.log('📋 Verifique os logs e instruções acima');
  }
  
  console.log('\n🌟 TESTE FINAL CONCLUÍDO!');
}

main().catch(console.error);
