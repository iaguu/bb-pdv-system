const fs = require('fs');

// Ler o arquivo
const filePath = 'src/renderer/components/orders/OrderFormModal.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Encontrar o final do arquivo e corrigir
const lines = content.split('\n');
let fixedLines = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i];
  
  // Se encontrou o final do Modal, corrigir a estrutura
  if (line.includes('</Modal>')) {
    fixedLines.push(line);
    i++;
    
    // Pular as linhas problemáticas até encontrar o fechamento correto
    while (i < lines.length && !lines[i].includes('}')) {
      if (lines[i].trim() === ')' && lines[i+1] && lines[i+1].includes('}')) {
        fixedLines.push('      )}');
        fixedLines.push('    </>');
        fixedLines.push('  );');
        fixedLines.push('}');
        i += 2;
        break;
      }
      i++;
    }
    continue;
  }
  
  fixedLines.push(line);
  i++;
}

// Escrever de volta
fs.writeFileSync(filePath, fixedLines.join('\n'), 'utf8');
console.log('Estrutura JSX final corrigida!');
