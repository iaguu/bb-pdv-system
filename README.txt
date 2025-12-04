# 🍕 Sistema de Pedidos – Pizzaria Anne & Tom
Uma aplicação desktop profissional para gestão de pedidos, clientes e cardápio de pizzaria, construída com **Electron + React** e persistência local em **JSON**.  
Projeto otimizado para simplicidade, velocidade e operação offline.

---

## 🚀 Tecnologias Utilizadas
- **Electron** — empacotamento desktop
- **React** — UI, componentes reutilizáveis e animações
- **JavaScript / Node.js**
- **JSON local** — banco de dados simplificado
- **ViaCEP API** — consulta de endereço
- **Vite** — build e hot reload
- **CSS moderno** — transições, gradientes suaves e microanimações

---

## 📂 Estrutura de Pastas

├── electron/
│ ├── db.js # Persistência em JSON
│ └── main.js # Processo principal do Electron
│
├── src/
│ ├── components/ # Componentes reutilizáveis
│ ├── pages/ # Telas principais
│ ├── data/ # Cardápio base
│ ├── hooks/ # Hooks personalizados
│ ├── utils/ # Helpers (CEP, currency, formatadores)
│ └── App.jsx
│
└── public/


---

## 🗃️ Banco de Dados Local
Todos os arquivos são salvos automaticamente em:

C:/Users/<user>/AppData/Roaming/<app>/data


Arquivos utilizados:

- `pizzas.json`
- `drinks.json`
- `extras.json`
- `customers.json`
- `orders.json`
- `settings.json`

O sistema cria todos os arquivos no primeiro uso.

---

## 📦 Recursos Principais

### ✅ **Gestão de Produtos**
- Listagem de pizzas, bebidas e adicionais  
- Tela detalhada ao clicar em cada pizza  
- Suporte a **pizza meio a meio**  
- Preços por tamanho (broto / grande)  
- Placeholders automáticos para imagens  
- Modal “Ver mais” com ingredientes e descrição  

---

### 🛒 **Carrinho e Checkout (3 etapas)**
1. **Carrinho**  
   - Itens, quantidades e totais  
2. **Dados do Cliente**  
   - Nome, telefone, CPF  
   - Endereço completo via ViaCEP  
3. **Pagamento**  
   - PIX  
   - Dinheiro  
   - Cartão  
   - Cupom PIX (primeira compra)  
   - Taxa de entrega por bairro  

---

### 👤 **Sistema de Clientes**
- Cadastro com dados pessoais e endereço  
- Histórico de pedidos  
- Normalização automática dos campos  
- Notas internas por cliente  

---

### 📑 **Pedidos**
Cada pedido registra:
- resumo legível  
- itens, adicionais e meio a meio  
- forma de pagamento  
- taxa de entrega  
- impressão  
- data e horário  
- total calculado  

---

### 🔄 **Importação/Exportação**

Cardápio completo em formato:

```json
{
  "version": 1,
  "exportedAt": "2025-12-01T22:15:10.000Z",
  "products": [...]
}

🎨 UI/UX

Home branca e elegante

Gradientes suaves

Transições animadas entre telas

Animação de fade-in de imagens

Espaçamentos amplos e harmônicos

Ícones e botões simples e funcionais

Carrinho sempre acessível

🧠 Personagem Atendente – “Anne”

O sistema inclui um modo de respostas com base em:

linguagem formal

postura calma e segura

humanização sem excesso

concessões mínimas (PIX/primeira compra)

estilo compatível com “Anne & Tom”

Ideal para WhatsApp, chatbot ou atendimento no balcão.

🛠️ Como rodar o projeto
1️⃣ Instalar dependências
npm install

2️⃣ Rodar ambiente de desenvolvimento
npm run dev

3️⃣ Empacotar a versão desktop
npm run build
npm run electron:build

🧪 Padronização de Código

Componentização

Hooks para lógica compartilhada

Helpers utilitários (formatCurrency, normalizeCustomer, lookupCep)

Separação clara entre UI e dados

Uso de useMemo e useEffect para performance

📌 Roadmap Futuro

Dashboard com gráficos

App mobile para entregadores

Modo escuro

Integração com WhatsApp Business API

Multiusuário com permissões

Upload de imagens de produtos

Sincronização opcional em nuvem

📄 Licença

Uso interno da Pizzaria Anne & Tom.
Não distribuído publicamente.