# -*- coding: utf-8 -*-
from pathlib import Path
path = Path('src/renderer/pages/SettingsPage.jsx')
text = path.read_text()
start = text.index('const API_ENDPOINT_GROUPS = [')
end = text.index('const API_METHODS =')
new_block = '''const API_ENDPOINT_GROUPS = [
  {
    title:  CORS e Saúde,
    description: Endpoints públicos para saúde e testes CORS.,
    endpoints: [
      {
        method: OPTIONS,
        path: *,
        auth: public,
        desc: Pré-flight CORS liberado para qualquer origem.,
      },
      {
        method: GET,
        path: /health,
        auth: public,
        desc: Verifica se o servidor responde.,
      },
    ],
  },
  {
    title: Cardápio,
    description: Produtos oficiais com e sem slug do cliente.,
    endpoints: [
      {
        method: GET,
        path: /api/menu,
        auth: api-key,
        desc: Cardápio principal.,
      },
      {
        method: GET,
        path: /:clientSlug/api/menu,
        auth: api-key,
        desc: Cardápio filtrado por cliente.,
      },
      {
        method: GET,
        path: /api/:clientSlug/menu,
        auth: api-key,
        desc: Cardápio antigo com slug no segmento final.,
      },
      {
        method: GET,
        path: /menu,
        auth: api-key,
        desc: Cardápio versão raiz.,
      },
      {
        method: GET,
        path: /:clientSlug/menu,
        auth: api-key,
        desc: Cardápio exposto com slug no início.,
      },
    ],
  },
  {
    title: PDV e Configurações,
    description: Resumo negócio e recursos específicos do PDV.,
    endpoints: [
      {
        method: GET,
        path: /api/pdv/settings,
        auth: api-key,
        desc: Configurações principais do PDV.,
      },
      {
        method: GET,
        path: /:clientSlug/api/pdv/settings,
        auth: api-key,
        desc: Mesmas configurações com client slug.,
      },
      {
        method: GET,
        path: /api/pdv/business-hours,
        auth: api-key,
        desc: Horários padrão do negócio.,
      },
      {
        method: GET,
        path: /:clientSlug/api/pdv/business-hours,
        auth: api-key,
        desc: Horário considerando client slug.,
      },
      {
        method: POST,
        path: /api/pdv/business-hours,
        auth: api-key,
        desc: Atualiza horários do PDV.,
      },
      {
        method: POST,
        path: /:clientSlug/api/pdv/business-hours,
        auth: api-key,
        desc: Atualiza horários com slug.,
      },
      {
        method: GET,
        path: /api/pdv/features,
        auth: api-key,
        desc: Flags de recursos habilitados.,
      },
      {
        method: GET,
        path: /:clientSlug/api/pdv/features,
        auth: api-key,
        desc: Flags por cliente.,
      },
      {
        method: GET,
        path: /api/pdv/summary,
        auth: api-key,
        desc: Resumo rápido do PDV.,
      },
      {
        method: GET,
        path: /:clientSlug/api/pdv/summary,
        auth: api-key,
        desc: Resumo por client slug.,
      },
      {
        method: GET,
        path: /api/pdv/health,
        auth: api-key,
        desc: Status do data dir e sincronização.,
      },
      {
        method: GET,
        path: /:clientSlug/api/pdv/health,
        auth: api-key,
        desc: Health com client slug.,
      },
      {
        method: GET,
        path: /api/pdv/products/disabled,
        auth: api-key,
        desc: Produtos desativados manualmente.,
      },
      {
        method: GET,
        path: /:clientSlug/api/pdv/products/disabled,
        auth: api-key,
        desc: Desativados para um cliente em especial.,
      },
      {
        method: GET,
        path: /api/pdv/products/availability,
        auth: api-key,
        desc: Disponibilidade inteligente dos itens.,
      },
      {
        method: GET,
        path: /:clientSlug/api/pdv/products/availability,
        auth: api-key,
        desc: Disponibilidade com slug.,
      },
      {
        method: GET,
        path: /api/pdv/stock/alerts,
        auth: api-key,
        desc: Alertas de estoque.,
      },
      {
        method: GET,
        path: /:clientSlug/api/pdv/stock/alerts,
        auth: api-key,
        desc: Alertas por cliente.,
      },
      {
        method: GET,
        path: /api/pdv/orders/metrics,
        auth: api-key,
        desc: Métricas consolidadas de pedidos.,
      },
      {
        method: GET,
        path: /:clientSlug/api/pdv/orders/metrics,
        auth: api-key,
        desc: Métricas com slug.,
      },
      {
        method: GET,
        path: /api/pdv/customers/segments,
        auth: api-key,
        desc: Segmentação de clientes.,
      },
      {
        method: GET,
        path: /:clientSlug/api/pdv/customers/segments,
        auth: api-key,
        desc: Segmentos personalizados.,
      },
      {
        method: GET,
        path: /api/pdv/delivery/quote,
        auth: api-key,
        desc: Simulação de quote de entrega.,
      },
      {
        method: GET,
        path: /:clientSlug/api/pdv/delivery/quote,
        auth: api-key,
        desc: Quote com client slug.,
      },
      {
        method: GET,
        path: /api/pdv/delivery/blocked-neighborhoods,
        auth: api-key,
        desc: Regiões bloqueadas para delivery.,
      },
      {
        method: GET,
        path: /:clientSlug/api/pdv/delivery/blocked-neighborhoods,
        auth: api-key,
        desc: Bloqueios por cliente.,
      },
      {
        method: GET,
        path: /api/pdv/printing/config,
        auth: api-key,
        desc: Configuração atual das impressoras.,
      },
      {
        method: GET,
        path: /:clientSlug/api/pdv/printing/config,
        auth: api-key,
        desc: Configuração por cliente.,
      },
    ],
  },
  {
    title: Clientes,
    description: Busca por telefone e cadastros.,
    endpoints: [
      {
        method: GET,
        path: /api/customers/by-phone,
        auth: api-key,
        desc: Busca padrão por telefone.,
      },
      {
        method: GET,
        path: /api/pdv/customers/by-phone,
        auth: api-key,
        desc: Busca no namespace PDV.,
      },
      {
        method: GET,
        path: /customers/by-phone,
        auth: api-key,
        desc: Busca alternativa sem /api.,
      },
      {
        method: POST,
        path: /api/customers,
        auth: api-key,
        desc: Cadastra cliente.,
      },
      {
        method: POST,
        path: /api/pdv/customers,
        auth: api-key,
        desc: Cria cliente no namespace PDV.,
      },
      {
        method: POST,
        path: /customers,
        auth: api-key,
        desc: Cria com rota reduzida.,
      },
    ],
  },
  {
    title: Pedidos,
    description: Fluxo completo de pedidos e streaming.,
    endpoints: [
      {
        method: GET,
        path: /api/orders,
        auth: api-key,
        desc: Lista pedidos.,
      },
      {
        method: GET,
        path: /:clientSlug/api/orders,
        auth: api-key,
        desc: Lista com slug.,
      },
      {
        method: POST,
        path: /api/orders,
        auth: api-key,
        desc: Cria novo pedido.,
      },
      {
        method: POST,
        path: /:clientSlug/api/orders,
        auth: api-key,
        desc: Cria novo pedido com slug.,
      },
      {
        method: PUT,
        path: /api/orders/:id,
        auth: api-key,
        desc: Atualiza pedido.,
      },
      {
        method: PUT,
        path: /:clientSlug/api/orders/:id,
        auth: api-key,
        desc: Atualiza com slug.,
      },
      {
        method: DELETE,
        path: /api/orders/:id,
        auth: api-key,
        desc: Remove pedido.,
      },
      {
        method: DELETE,
        path: /:clientSlug/api/orders/:id,
        auth: api-key,
        desc: Remove com slug.,
      },
      {
        method: POST,
        path: /api/orders/reset,
        auth: api-key,
        desc: Reseta a coleção de pedidos.,
      },
      {
        method: POST,
        path: /:clientSlug/api/orders/reset,
        auth: api-key,
        desc: Reseta pedidos com slug.,
      },
      {
        method: GET,
        path: /api/orders/stream,
        auth: api-key,
        desc: Stream de eventos de pedidos.,
      },
      {
        method: GET,
        path: /:clientSlug/api/orders/stream,
        auth: api-key,
        desc: Stream com slug.,
      },
    ],
  },
  {
    title: Motoboys,
    description: Status tracking e links QR.,
    endpoints: [
      {
        method: PUT,
        path: /api/motoboys/:id/status,
        auth: api-key,
        desc: Atualiza status instantaneamente.,
      },
      {
        method: GET,
        path: /api/motoboys/:id/status,
        auth: api-key,
        desc: Consulta status do motoboy.,
      },
      {
        method: GET,
        path: /motoboy/pedido/:orderId,
        auth: public,
        desc: Tracking público do pedido.,
      },
      {
        method: GET,
        path: /:clientSlug/motoboy/pedido/:orderId,
        auth: public,
        desc: Tracking com slug.,
      },
      {
        method: POST,
        path: /motoboy/pedido/:orderId/link,
        auth: api-key,
        desc: Vincula motoboy via QR.,
      },
      {
        method: POST,
        path: /:clientSlug/motoboy/pedido/:orderId/link,
        auth: api-key,
        desc: Mesmo link com slug.,
      },
      {
        method: POST,
        path: /motoboy/token/validate,
        auth: api-key,
        desc: Valida token QR do motoboy.,
      },
    ],
  },
  {
    title: Pagamentos e Webhooks,
    description: AxionPay e integrações externas.,
    endpoints: [
      {
        method: POST,
        path: /axionpay/card,
        auth: api-key,
        desc: Gera pagamento com cartão.,
      },
      {
        method: POST,
        path: /axionpay/pix,
        auth: api-key,
        desc: Gera payload PIX via AxionPay.,
      },
      {
        method: POST,
        path: /api/webhook-infinitepay,
        auth: api-key,
        desc: Recebe webhook InfinitePay.,
      },
    ],
  },
  {
    title: Sincronização e Coleções,
    description: Endpoints genéricos e de sincronização.,
    endpoints: [
      {
        method: GET,
        path: /sync/collections,
        auth: api-key,
        desc: Lista coleções disponíveis.,
      },
      {
        method: GET,
        path: /:clientSlug/sync/collections,
        auth: api-key,
        desc: Coleções com slug.,
      },
      {
        method: GET,
        path: /sync/collection/:collection,
        auth: api-key,
        desc: Delta/full da coleção.,
      },
      {
        method: GET,
        path: /:clientSlug/sync/collection/:collection,
        auth: api-key,
        desc: Mesma coleção com slug.,
      },
      {
        method: POST,
        path: /sync/collection/:collection,
        auth: api-key,
        desc: Envia delta ou full.,
      },
      {
        method: POST,
        path: /:clientSlug/sync/collection/:collection,
        auth: api-key,
        desc: Envio com slug.,
      },
      {
        method: GET,
        path: /api/:collection,
        auth: api-key,
        desc: Listagem genérica de coleções.,
      },
      {
        method: GET,
        path: /:clientSlug/api/:collection,
        auth: api-key,
        desc: Listagem com slug.,
      },
      {
        method: POST,
        path: /api/:collection,
        auth: api-key,
        desc: Adiciona item em qualquer coleção.,
      },
      {
        method: POST,
        path: /:clientSlug/api/:collection,
        auth: api-key,
        desc: Mesma rota com slug.,
      },
      {
        method: PUT,
        path: /api/:collection/:id,
        auth: api-key,
        desc: Atualiza item genérico.,
      },
      {
        method: PUT,
        path: /:clientSlug/api/:collection/:id,
        auth: api-key,
        desc: Atualização com slug.,
      },
      {
        method: DELETE,
        path: /api/:collection/:id,
        auth: api-key,
        desc: Remove item genérico.,
      },
      {
        method: DELETE,
        path: /:clientSlug/api/:collection/:id,
        auth: api-key,
        desc: Remove com slug.,
      },
      {
        method: POST,
        path: /api/:collection/reset,
        auth: api-key,
        desc: Reset total da coleção.,
      },
      {
        method: POST,
        path: /:clientSlug/api/:collection/reset,
        auth: api-key,
        desc: Reset com slug.,
      },
    ],
  },
];
'''
new_block = new_block.replace(\n, \r\n) + \r\n\r\n
path.write_text(text[:start] + new_block + text[end:])
