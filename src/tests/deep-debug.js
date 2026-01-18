// src/tests/deep-debug.js
// Debug profundo do problema de tela branca em tempo de execução

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔍 DEBUG PROFUNDO - TELA BRANCA\n');

// Configurações
const projectRoot = path.join(__dirname, '../..');
const electronPath = path.join(projectRoot, 'dist-electron/win-unpacked/AXION PDV.exe');
const devCommand = 'set ENV_FILE=.env.production&& electron .';

// Função para capturar saída do processo
function runElectronWithDebug() {
  return new Promise((resolve) => {
    console.log('🚀 Iniciando AXION PDV em modo debug...\n');
    
    // Tenta executar em modo development primeiro
    const electronProcess = spawn('cmd', ['/c', `cd "${projectRoot}" && ${devCommand}`], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
      timeout: 15000
    });

    let stdout = '';
    let stderr = '';
    let hasError = false;
    let hasReactOutput = false;

    // Captura stdout
    electronProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      
      console.log('📄 STDOUT:', output.trim());
      
      // Verifica se React está sendo renderizado
      if (output.includes('React') || output.includes('ReactDOM') || output.includes('createRoot')) {
        hasReactOutput = true;
      }
      
      // Verifica se a aplicação iniciou
      if (output.includes('ready') || output.includes('started') || output.includes('loaded')) {
        console.log('✅ Aplicação iniciada com sucesso!');
      }
    });

    // Captura stderr
    electronProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      hasError = true;
      
      console.log('❌ STDERR:', error.trim());
      
      // Verifica erros críticos
      if (error.includes('ERROR') || error.includes('FATAL') || error.includes('Cannot find module')) {
        console.log('🚨 ERRO CRÍTICO DETECTADO!');
      }
    });

    // Evento de fechamento
    electronProcess.on('close', (code) => {
      console.log('\n📊 Processo finalizado');
      console.log('📋 Exit code:', code);
      console.log('🔍 Has error:', hasError);
      console.log('🔍 Has React output:', hasReactOutput);
      
      resolve({
        exitCode: code,
        stdout,
        stderr,
        hasError,
        hasReactOutput
      });
    });

    // Timeout
    setTimeout(() => {
      if (!electronProcess.killed) {
        console.log('⏰ Timeout - encerrando processo...');
        electronProcess.kill('SIGTERM');
      }
    }, 15000);
  });
}

// Função para verificar o console do navegador
async function checkBrowserConsole() {
  console.log('\n📋 VERIFICAÇÃO DO CONSOLE DO NAVEGADOR\n');
  
  // Cria um script para verificar o console
  const consoleCheckScript = `
    // Verificação do console em tempo de execução
    console.log('🔍 Iniciando verificação do console...');
    
    // Verifica se o DOM está pronto
    document.addEventListener('DOMContentLoaded', () => {
      console.log('✅ DOM carregado');
      
      // Verifica se o elemento root existe
      const root = document.getElementById('root');
      if (root) {
        console.log('✅ Elemento #root encontrado');
        console.log('📊 Conteúdo do root:', root.innerHTML.length > 0 ? 'Tem conteúdo' : 'Vazio');
        
        // Verifica se React foi carregado
        if (window.React) {
          console.log('✅ React carregado');
        } else {
          console.log('❌ React não encontrado');
        }
        
        if (window.ReactDOM) {
          console.log('✅ ReactDOM carregado');
        } else {
          console.log('❌ ReactDOM não encontrado');
        }
        
        // Verifica se há erros no console
        const originalError = console.error;
        console.error = function(...args) {
          originalError.apply(console, args);
          console.log('🚨 Erro detectado:', args);
        };
        
        // Verifica se há warnings
        const originalWarn = console.warn;
        console.warn = function(...args) {
          originalWarn.apply(console, args);
          console.log('⚠️ Warning detectado:', args);
        };
        
      } else {
        console.log('❌ Elemento #root não encontrado');
      }
    });
    
    // Timeout para verificar se algo deu errado
    setTimeout(() => {
      const root = document.getElementById('root');
      if (!root || root.innerHTML.length === 0) {
        console.log('❌ PROBLEMA: Root element vazio após 5 segundos');
        console.log('🔍 Verificando possíveis causas...');
        
        // Verifica se há scripts carregados
        const scripts = document.querySelectorAll('script');
        console.log('📊 Scripts encontrados:', scripts.length);
        scripts.forEach((script, index) => {
          console.log('  Script ' + index + ': ' + (script.src || 'inline'));
        });
        
        // Verifica se há estilos carregados
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        console.log('📊 CSS encontrados:', links.length);
        links.forEach((link, index) => {
          console.log('  CSS ' + index + ': ' + link.href);
        });
      }
    }, 5000);
  `;
  
  // Salva o script para uso posterior
  const scriptPath = path.join(projectRoot, 'console-check.js');
  fs.writeFileSync(scriptPath, consoleCheckScript);
  console.log('📄 Script de verificação salvo em:', scriptPath);
}

// Função para analisar o bundle JavaScript
function analyzeJsBundle() {
  console.log('\n📋 ANÁLISE DO BUNDLE JAVASCRIPT\n');
  
  const jsPath = path.join(projectRoot, 'dist/assets/index-DVKlQ-mq.js');
  
  if (!fs.existsSync(jsPath)) {
    console.log('❌ Bundle JavaScript não encontrado');
    return;
  }
  
  try {
    const jsContent = fs.readFileSync(jsPath, 'utf8');
    
    // Verificações críticas
    const checks = [
      { name: 'React', pattern: /react|React/ },
      { name: 'ReactDOM', pattern: /react-dom|ReactDOM/ },
      { name: 'createRoot', pattern: /createRoot/ },
      { name: 'App component', pattern: /App/ },
      { name: 'Router', pattern: /BrowserRouter|HashRouter/ },
      { name: 'StrictMode', pattern: /StrictMode/ }
    ];
    
    console.log('🔍 Verificando componentes críticos:');
    checks.forEach(({ name, pattern }) => {
      const found = pattern.test(jsContent);
      console.log(`${found ? '?' : '?'} ${name}`);
    });
    
    // Verifica se há erros de importação
    const importErrors = [
      /Cannot resolve module/,
      /Module not found/,
      /Error: Cannot find module/
    ];
    
    const hasImportErrors = importErrors.some(pattern => pattern.test(jsContent));
    if (hasImportErrors) {
      console.log('❌ Erros de importação detectados no bundle');
    } else {
      console.log('✅ Nenhum erro de importação óbvio no bundle');
    }
    
    // Verifica tamanho e estrutura
    console.log('📊 Estatísticas do bundle:');
    console.log(`   Tamanho: ${(jsContent.length / 1024).toFixed(2)} KB`);
    console.log(`   Linhas: ${jsContent.split('\n').length}`);
    console.log(`   Funções: ${(jsContent.match(/function/g) || []).length}`);
    console.log(`   Classes: ${(jsContent.match(/class/g) || []).length}`);
    
  } catch (error) {
    console.log('❌ Erro ao analisar bundle:', error.message);
  }
}

// Função principal
async function main() {
  console.log('🎯 INICIANDO DEBUG PROFUNDO\n');
  
  // 1. Analisa o bundle JavaScript
  analyzeJsBundle();
  
  // 2. Verificação do console
  await checkBrowserConsole();
  
  // 3. Tenta executar o Electron
  console.log('\n📋 TENTATIVA DE EXECUÇÃO\n');
  
  try {
    const result = await runElectronWithDebug();
    
    console.log('\n🎯 RESULTADO DO DEBUG\n');
    console.log('='.repeat(50));
    
    if (result.hasError) {
      console.log('❌ ERROS DETECTADOS NA EXECUÇÃO');
      console.log('Stderr:', result.stderr);
    } else {
      console.log('✅ NENHUM ERRO DETECTADO NA EXECUÇÃO');
    }
    
    if (result.hasReactOutput) {
      console.log('✅ REACT ESTÁ SENDO CARREGADO');
    } else {
      console.log('❌ REACT NÃO ESTÁ SENDO CARREGADO');
    }
    
    if (result.exitCode === 0) {
      console.log('✅ APLICAÇÃO FINALIZOU NORMALMENTE');
    } else {
      console.log(`?? APLICA??O FINALIZOU COM C?DIGO ${result.exitCode}`);
    }
    
    // Recomendações finais
    console.log('\n📋 RECOMENDAÇÕES FINAIS\n');
    
    if (result.hasError) {
      console.log('🔧 CORREÇÕES SUGERIDAS:');
      console.log('1. Verifique os erros no stderr acima');
      console.log('2. Verifique se todas as dependências estão instaladas');
      console.log('3. Verifique as variáveis de ambiente');
      console.log('4. Tente executar em modo desenvolvimento');
    } else if (!result.hasReactOutput) {
      console.log('🔧 PROBLEMAS POSSÍVEIS:');
      console.log('1. React não está sendo carregado corretamente');
      console.log('2. Verifique o bundle do JavaScript');
      console.log('3. Verifique se há conflitos de versão');
      console.log('4. Verifique o caminho dos arquivos');
    } else {
      console.log('✅ APLICAÇÃO PARECE ESTAR FUNCIONAL');
      console.log('🔍 Se ainda há tela branca:');
      console.log('1. Verifique as DevTools no Electron');
      console.log('2. Verifique se há erros no console do navegador');
      console.log('3. Verifique se o CSS está sendo carregado');
      console.log('4. Verifique se há problemas de renderização');
    }
    
  } catch (error) {
    console.log('❌ Erro durante o debug:', error.message);
  }
  
  console.log('\n🌟 DEBUG CONCLUÍDO!');
}

// Executa o debug
main().catch(console.error);
