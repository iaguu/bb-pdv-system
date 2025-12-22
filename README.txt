# 🧾 AXION PDV - Sistema de Ponto de Venda Desktop (Electron + React)

## 🧠 Sobre o Projeto

O **AXION PDV** e um sistema completo de frente de caixa / gestao de pedidos, criado com **Electron + React**, pensado para funcionar 100% offline, com banco de dados local em JSON.
Ele foi desenvolvido para ser o PDV central, oferecendo robustez e agilidade operacional.

Ideal para:
- Pizzarias
- Lanchonetes
- Restaurantes
- Deliveries proprios
- Pequenos e medios comercios

---

## 🧩 Principais Modulos

### 📦 Pedidos
- Interface rapida com busca e clique agil
- Pizzas com ate 3 sabores
- Adicionais, observacoes e modificacoes por item
- Cupom de cozinha e balcao (estilizados e revisados)
- Impressao silenciosa (silentPrint)
- Mudanca automatica de status
- Integracao com motoboy via QR Code

### 👥 Clientes
- Cadastro completo
- Busca por telefone (com mascara + normalizacao)
- Historico completo de pedidos
- Tags (VIP, primeira compra, etc.)

### 🍕 Produtos
- CRUD completo
- Ingredientes com badges removiveis
- Precos por tamanho
- Disponibilidade ativa/pausada
- Normalizacao automatica

### 🖨️ Impressao
- Tickets modernos e faceis de ler
- Cupom especial para cozinha (cores e espacamento)
- Cupom de balcao com layout profissional
- Impressoras separadas (cozinha / balcao)
- Teste de impressora integrado

### ⚙️ Configuracoes
- Selecao de impressoras detectadas via Electron
- Persistencia automatica (settings.json)
- Taxas de entrega por bairro / distancia
- Informacoes do estabelecimento
- Tema e preferencias visuais

---

## 🏗️ Arquitetura do Sistema

```text
axion-pdv/
|
|-- electron/
|   |-- main.js          # Processo principal: impressao, QRCode, comunicacao IPC
|   |-- db.js            # DataEngine com JSON local
|   |-- printer/         # Modulos especificos de impressao
|
|-- src/
|   |-- components/      # Componentes reutilizaveis
|   |-- pages/           # Paginas (Orders, Products, Customers...)
|   |-- hooks/           # Hooks com logicas isoladas
|   |-- utils/           # Helpers e normalizacoes
|   |-- styles/          # SCSS / tokens / layout
|   |-- data/            # Estruturas JSON estaticas
|   |-- App.jsx
|
|-- public/
|-- package.json
|-- vite.config.js
```

---

## 🚀 Como Rodar

### ✅ Requisitos
- Node.js (versao LTS)
- NPM ou Yarn
- Windows (recomendado), Linux ou macOS

### 🧪 Ambiente de Desenvolvimento

```bash
# Clone o repositorio
git clone https://github.com/iaguu/axion-pdv.git

# Entre na pasta
cd axion-pdv

# Instale as dependencias
npm install

# Inicie o projeto
npm run dev
```

Electron + React iniciam juntos.

---

## 🏗️ Build Para Producao (App Desktop)

```bash
npm run build
npm run electron:build
```

O executavel ficara na pasta `/dist-electron`.

---

## 🗂️ Banco de Dados Local (DataEngine)

O banco e estruturado em arquivos .json locais, garantindo total autonomia offline:

```text
data/
|-- products.json
|-- customers.json
|-- orders.json
|-- settings.json
```

- Criados automaticamente
- Totalmente offline
- Facilmente copiaveis para backup
- Sem necessidade de servidor remoto

---

## 🔗 Integracoes Internas

### 📍 CEP
Integracao com ViaCEP (auto-preenchimento de endereco).

### 🛵 Motoboy com QR Code
- Ticket imprime um QR Code
- Motoboy escaneia
- Pedido muda para "em entrega" automaticamente

### 🖨️ Impressoras
- Listagem automatica via Electron
- Impressoras separadas por funcao (cozinha/balcao)
- Teste de impressao e silent printing

---

## 🧪 Comandos Principais

| Comando | Funcao |
| --- | --- |
| npm run dev | Inicia React + Electron no modo dev |
| npm run build | Compila o React |
| npm run electron:build | Cria o app desktop (instalador) |
| npm run preview | Testa build web |

---

## 🧭 Roadmap Oficial (2025)

### 🔥 Em desenvolvimento
- Revisao total do ticket da cozinha
- Taxa de entrega por distancia (padrao Chora Menino)
- Integracao total com motoboy
- Revisao completa do catalogo e precos

### 🧱 Planejado
- Dashboard financeiro
- Modulo de estoque avancado
- Exportacao de relatorios (PDF/CSV)
- Modo dark
- Multiusuario (Admin / Caixa / Gerencia)

### 🚀 Futuro
- App Cliente
- App Gerencial
- Sync com backend remoto

---

## ✍️ Padroes de Codigo
- Componentes pequenos e claros
- Logicas isoladas em hooks
- Normalizacoes universais (normalizeStatus, normalizePhone, etc.)
- SCSS modular por tokens/layout/componentes
- Comentarios explicativos nas areas criticas (impressoras, db, QRCode)

---

## 🤝 Como Contribuir
- Faca um fork
- Crie uma branch: `git checkout -b feature/minha-feature`
- Commit: `git commit -m "feat: descreva sua feature"`
- Envie o PR

---

## 📜 Licenca
Este projeto nao define licenca e e, por padrao, de uso restrito.

---

## 👤 Autor
Iago Ferreira Barreto
Criador do ecossistema Axion
Desenvolvedor especializado em solucoes de PDV, React e Electron.

