const fs = require('fs');

// Ler o arquivo
const filePath = 'src/renderer/components/orders/OrderFormModal.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Corrigir o final do arquivo removendo linhas problemáticas e adicionando a estrutura correta
content = content.replace(
  /        <\/Modal>\s*\)}\s*\n\s*<>\s*\n\s*\);\s*\n\s*}/gs,
  `        </Modal>
      )}
    </>
  );
}`
);

// Escrever de volta
fs.writeFileSync(filePath, content, 'utf8');
console.log('Arquivo corrigido com sucesso!');
