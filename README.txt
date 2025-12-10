🧾 BB-PDV System — Sistema de Ponto de Venda Desktop (Electron + React)

<p align="center"> <b>Um sistema de PDV rápido, moderno e totalmente offline, criado para pizzarias e deliveries.</b> </p> <p align="center"> <img src="https://img.shields.io/badge/Electron-Desktop-blue?logo=electron" /> <img src="https://img.shields.io/badge/React-18.0-61dafb?logo=react" /> <img src="https://img.shields.io/badge/Node.js-Backend-success?logo=node.js" /> <img src="https://img.shields.io/badge/Database-JSON-orange?logo=json" /> <img src="https://img.shields.io/badge/Status-Em%20Desenvolvimento-yellow" /> </p>
📌 Sobre o Projeto

O BB-PDV System é um sistema completo de frente de caixa / gestão de pedidos, criado com Electron + React, pensado para funcionar 100% offline, com banco de dados local em JSON.
Ele é utilizado como PDV principal do ecossistema Anne & Tom (website → PDV → app motoboy).

Ideal para:

Pizzarias

Lanchonetes

Restaurantes

Deliveries próprios

Pequenos e médios comércios

🧩 Principais Módulos
🛒 Pedidos

Interface rápida com busca e clique ágil

Pizzas com até 3 sabores

Adicionais, observações e modificações por item

Cupom de cozinha e balcão (estilizados e revisados)

Impressão silenciosa (silentPrint)

Mudança automática de status

Integração com motoboy via QR Code

👤 Clientes

Cadastro completo

Busca por telefone (com máscara + normalização)

Histórico completo de pedidos

Tags (VIP, primeira compra, etc.)

🍕 Produtos

CRUD completo

Ingredientes com badges removíveis

Preços por tamanho

Disponibilidade ativa/pausada

Normalização automática

🖨️ Impressão

Tickets modernos e fáceis de ler

Cupom especial para cozinha (cores e espaçamento)

Cupom de balcão com layout profissional

Impressoras separadas (cozinha / balcão)

Teste de impressora integrado

⚙️ Configurações

Seleção de impressoras detectadas via Electron

Persistência automática (settings.json)

Taxas de entrega por bairro / distância

Informações da pizzaria

Tema e preferências visuais

🏗 Arquitetura do Sistema

bb-pdv-system/
│
├── electron/
│   ├── main.js          # Processo principal: impressão, QRCode, comunicação IPC
│   ├── db.js            # DataEngine com JSON local
│   └── printer/         # Módulos específicos de impressão
│
├── src/
│   ├── components/      # Componentes reutilizáveis
│   ├── pages/           # Páginas (Orders, Products, Customers...)
│   ├── hooks/           # Hooks com lógicas isoladas
│   ├── utils/           # Helpers e normalizações
│   ├── styles/          # SCSS / tokens / layout
│   ├── data/            # Estruturas JSON estáticas
│   └── App.jsx
│
├── public/
├── package.json
└── vite.config.js

Como Rodar
✔ Requisitos

Node.js — versão LTS

NPM ou Yarn

Windows (recomendado), Linux ou macOS

▶️ Ambiente de Desenvolvimento
git clone https://github.com/iaguu/bb-pdv-system.git
cd bb-pdv-system

npm install
npm run dev


Electron + React iniciarão juntos.

🏗 Build Para Produção (App Desktop)
npm run build
npm run electron:build


O executável ficará em /dist.

🗃 Banco de Dados Local (DataEngine)

O banco é simplesmente uma pasta com arquivos .json:

data/
├── products.json
├── customers.json
├── orders.json
└── settings.json


Criados automaticamente

Totalmente offline

Facilmente copiáveis para backup

Sem necessidade de servidor remoto

🔌 Integrações Internas
📍 CEP

Integração com ViaCEP (auto-preenchimento de endereço).

🚚 Motoboy com QR Code

Ticket imprime um QR Code

Motoboy escaneia

Pedido muda para “em entrega”

🖨 Impressoras

Listagem automática via Electron

Impressoras separadas por função

Teste de impressão

Impressão silenciosa

🔧 Comandos Principais
Comando	Função
npm run dev	Inicia React + Electron no modo dev
npm run build	Compila o React
npm run electron:build	Cria o app desktop
npm run preview	Testa build web
npm run lint	Verifica inconsistências
📌 Roadmap Oficial (2025)
🟢 Em desenvolvimento

Revisão total do ticket da cozinha

Taxa de entrega por distância (Chora Menino padrão)

Integração total com motoboy

Revisão completa do catálogo e preços

🟡 Planejado

Dashboard financeiro

Módulo de estoque avançado

Exportação de relatórios (PDF/CSV)

Modo dark

Multiusuário (Admin / Caixa / Gerência)

🔴 Futuro

App Cliente

App Gerencial

Sync com backend remoto

🧪 Padrões de Código

Componentes pequenos e claros

Lógicas isoladas em hooks

Normalizações universais (normalizeStatus, normalizePhone, etc.)

SCSS modular por tokens/layout/componentes

Comentários explicativos nas áreas críticas (impressores, db, QRCode)

🤝 Como Contribuir

Faça um fork

Crie uma branch:

git checkout -b feature/minha-feature


Commit:

git commit -m "feat: descreva sua feature"


Envie o PR

📝 Licença

Este projeto não define licença e é, por padrão, de uso restrito.

👨‍💻 Autor

Iago Ferreira Barreto
Criador do ecossistema BB Systems / Anne & Tom
Desenvolvedor especializado em soluções de PDV, React e Electron.
