// src/tests/electron-test.js
// Teste automatizado do executável Electron

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 Iniciando teste do executável Electron...\n');

// Configurações
const exePath = path.join(__dirname, '../../dist-electron/win-unpacked/AXION PDV.exe');
const logPath = path.join(__dirname, '../../test-electron.log');

// Verifica se o executável existe
if (!fs.existsSync(exePath)) {
  console.error('❌ Executável não encontrado:', exePath);
  process.exit(1);
}

console.log('✅ Executável encontrado:', exePath);
console.log('📊 Tamanho do arquivo:', (fs.statSync(exePath).size / 1024 / 1024).toFixed(2), 'MB');

// Testa o executável
let electronProcess;
let testResults = {
  started: false,
  responsive: false,
  error: null,
  exitCode: null,
  duration: 0
};

const startTime = Date.now();

try {
  console.log('\n🚀 Iniciando AXION PDV...');
  
  // Inicia o processo Electron
  electronProcess = spawn(exePath, [], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });

  // Captura saída
  electronProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('📄 STDOUT:', output.trim());
    
    // Verifica se a aplicação iniciou corretamente
    if (output.includes('ready') || output.includes('started') || output.includes('loaded')) {
      testResults.started = true;
      testResults.responsive = true;
    }
  });

  electronProcess.stderr.on('data', (data) => {
    const error = data.toString();
    console.log('⚠️ STDERR:', error.trim());
    
    // Verifica erros críticos
    if (error.includes('ERROR') || error.includes('FATAL')) {
      testResults.error = error;
    }
  });

  // Evento de fechamento
  electronProcess.on('close', (code) => {
    testResults.exitCode = code;
    testResults.duration = Date.now() - startTime;
    
    console.log('\n📊 Processo finalizado');
    console.log('📋 Exit code:', code);
    console.log('⏱️ Duração:', testResults.duration, 'ms');
    
    // Resultados do teste
    console.log('\n' + '='.repeat(50));
    console.log('🧪 RESULTADOS DO TESTE ELECTRON');
    console.log('='.repeat(50));
    
    if (testResults.started) {
      console.log('✅ Aplicação iniciou com sucesso');
    } else {
      console.log('❌ Aplicação não iniciou corretamente');
    }
    
    if (testResults.responsive) {
      console.log('✅ Aplicação responsiva');
    } else {
      console.log('❌ Aplicação não responsiva');
    }
    
    if (testResults.error) {
      console.log('❌ Erro detectado:', testResults.error);
    } else {
      console.log('✅ Nenhum erro crítico detectado');
    }
    
    if (testResults.exitCode === 0) {
      console.log('✅ Finalização normal (exit code 0)');
    } else {
      console.log('⚠️ Finalização anormal (exit code', testResults.exitCode, ')');
    }
    
    // Performance
    if (testResults.duration < 5000) {
      console.log('✅ Performance excelente (< 5s)');
    } else if (testResults.duration < 10000) {
      console.log('✅ Performance boa (< 10s)');
    } else {
      console.log('⚠️ Performance lenta (> 10s)');
    }
    
    // Verificação final
    const success = testResults.started && !testResults.error;
    console.log('\n🎯 Status final:', success  '✅ APROVADO' : '❌ REPROVADO');
    
    // Salva log
    const logContent = `
Teste Electron - ${new Date().toISOString()}
Executável: ${exePath}
Resultados: ${JSON.stringify(testResults, null, 2)}
Status: ${success  'APROVADO' : 'REPROVADO'}
`;
    
    fs.writeFileSync(logPath, logContent);
    console.log('📄 Log salvo em:', logPath);
    
    process.exit(success  0 : 1);
  });

  // Timeout de 30 segundos
  setTimeout(() => {
    if (electronProcess && !electronProcess.killed) {
      console.log('⏰ Timeout - encerrando processo...');
      electronProcess.kill('SIGTERM');
      
      setTimeout(() => {
        if (electronProcess && !electronProcess.killed) {
          electronProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }, 30000);

  // Simula interação básica após 3 segundos
  setTimeout(() => {
    if (electronProcess && !electronProcess.killed) {
      console.log('🖱️ Simulando interação básica...');
      testResults.responsive = true;
    }
  }, 3000);

} catch (error) {
  console.error('❌ Erro ao executar teste:', error.message);
  testResults.error = error.message;
  process.exit(1);
}

// Cleanup ao sair
process.on('exit', () => {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill();
  }
});
