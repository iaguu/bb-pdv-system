const fs = require('fs');

// Ler o arquivo
const filePath = 'src/renderer/components/orders/OrderFormModal.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Corrigir o problema do JSX fragment no final
content = content.replace(
  /<\/Modal>\s*\)}\s*\n\s*<>\s*\n\s*\);\s*\n\s*}/g,
  '</Modal>\n      )}\n    </>\n  );\n}'
);

// Escrever de volta
fs.writeFileSync(filePath, content, 'utf8');
console.log('Sintaxe JSX corrigida!');
