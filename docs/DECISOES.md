# Caixa Claro: decisões e plano de implementação

Registro das decisões tomadas no projeto (Desafio 2: Gestor Inteligente de Pequenos Negócios, Integrativa SI 2026.2): o que foi decidido, por quê e como está (ou será) implementado.

**Situação em 29/10/2026:**
- **Fase 1 (MVP com lançamento manual):** pronta, publicada no GitHub, com PDF do pitch.
- **Fase 2 (dados automáticos do banco):** implementada e testada com dados simulados no formato da Pluggy. Falta testar com a Pluggy de verdade (seção 9).

---

## 1. Ponto de partida

| Fonte | O que usamos |
|---|---|
| `Integrativa_SI_2026.2_-_Desafios.pdf`, Desafio 2 | O fluxo obrigatório **Entrada → Organização → Indicadores → Informação útil para decisão**. Foco em resolver bem um problema, e não em montar um ERP. |
| Pesquisa com 6 pequenos empresários | O público-alvo e as funcionalidades (seção 2) |
| `solucao_desafio2.pdf` | O conceito "Caixa Claro", as 5 funcionalidades, as regras de alerta, as telas e a stack |

---

## 2. Decisões de produto

### D1. Público-alvo: o "grupo B" da pesquisa
**Decisão:** focar em quem fatura até R$ 30 mil, anota no caderno ou de cabeça e trabalha sozinho (4 de 6 respostas).
**Por quê:** os 2 "organizados" (acima de R$ 80 mil, com sistema) não têm dificuldade. No grupo B:
- 4/4 sabem entradas e saídas só "mais ou menos";
- 4/4 misturam o dinheiro pessoal com o da empresa;
- 3/4 só sabem as contas do próximo mês;
- 2/4 gastam de 30 min a 1 h por dia conferindo cadernos.

**Limitação declarada:** 6 respostas é uma amostra pequena. O resultado é indicativo, não estatístico.

### D2. Foco único: previsão de caixa + aviso diário
**Decisão:** o app faz uma coisa bem feita: prevê o caixa dos próximos 30 dias e avisa todo dia.
**Por quê:** 5 de 6 deram nota 5 para "app que avisa se o caixa vai faltar em 30 dias". Para o aviso diário, o pedido mais comum foi "contas que vencem amanhã" (3 de 6), seguido de "quanto sobrou de lucro no dia" (2 de 6).

### D3. Funcionalidades do MVP (5 + 1)
1. Lançamento rápido (meta de menos de 10 s).
2. Separação pessoal × empresa ("Tirei dinheiro para mim").
3. Contas a pagar com vencimento e recorrência mensal.
4. Previsão de 30 dias com semáforo.
5. Aviso diário (tela "Resumo de hoje" + notificação).
6. **Acréscimo nosso:** simulador "E se…?" (retirar menos / vender mais). O desafio pede "ajudar a interpretar os dados para apoiar uma decisão", e o simulador mostra o efeito de uma decisão antes de tomá-la.

### D4. O que ficou fora (de propósito)
- **Fiado / contas a receber:** ninguém na pesquisa vende fiado.
- **Nota fiscal, estoque, folha:** não é ERP.
- **Integração bancária:** inicialmente fora, por complexidade. **Revista na D14**, a pedido do usuário.

### D5. Regras de alerta (a "inteligência")
Regras simples e explicáveis, sem caixa-preta. Código em `src/lib/financas.js`.

| Alerta | Regra |
|---|---|
| Conta atrasada / vence hoje / vence amanhã | vencimento < hoje / = hoje / = amanhã |
| Caixa vai faltar (vermelho) | saldo projetado < 0 em algum dia dos próximos 30. Sugere reduzir retiradas ou negociar a maior conta. |
| Caixa apertado (amarelo) | caixa de hoje < contas dos próximos 7 dias, **ou** no pior dia sobra menos que 1 semana de gastos + retiradas (ver D6) |
| Retirada acima do lucro | retiradas do mês > entradas − saídas do mês |
| Gasto fora do padrão | categoria no mês > 130% da média dos até 3 meses anteriores |
| Resultado piorando | lucro do mês até hoje < lucro do mesmo período do mês anterior |

**Fórmula da previsão:** `saldo(dia) = saldo(dia−1) + média diária de entradas − média de gastos do dia a dia − média de retiradas − contas que vencem no dia`.
- As médias usam os últimos 30 dias.
- Pagamentos de contas não entram na média, porque as contas já são projetadas pelo vencimento e seriam contadas duas vezes.
- Contas atrasadas são descontadas já no dia de hoje.

### D6. Ajuste no semáforo amarelo
**Problema encontrado no teste:** o semáforo ficava **verde** com apenas R$ 43 no pior dia.
**Decisão:** também é amarelo quando o menor saldo projetado é menor que 1 semana de gastos do dia a dia + retiradas. No simulador, usa as retiradas simuladas.

### D7. Dados de demonstração
**Decisão:** o app abre com dados **simulados** de um pet shop de 1 pessoa, com cerca de R$ 8 mil/mês (perfil do grupo B). A tela avisa que são simulados.
- O gerador usa uma semente pela data, então a mesma data sempre gera os mesmos dados.
- Ele calibra o saldo para que o cenário seja sempre "vai faltar dinheiro" (pior dia ≈ −R$ 450).
- Inclui de propósito: retirada pessoal grande, conserto fora do padrão e um boleto vencendo amanhã, para os alertas aparecerem.

**Por quê:** o desafio permite dados simulados, desde que se indique a origem.

---

## 3. Decisões técnicas (fase 1)

| # | Decisão | Por quê |
|---|---|---|
| D8 | **Web app mobile-first (PWA)** | O dono usa o celular. Instala como app sem loja e funciona offline (service worker). |
| D9 | **React 18 + Vite + Tailwind 4 + Recharts** | Stack sugerida na solução, rápida de desenvolver. |
| D10 | **Dados no aparelho (`localStorage`), sem login nem servidor** | MVP simples e sem custo, sem dado sensível em servidor. *(Muda na fase 2, ver D16.)* |
| D11 | **Regras em funções puras, separadas da tela** (`src/lib/`) | Dá para testar. Hoje são 11 testes automatizados (`npm test`). |
| D12 | **Datas como texto `AAAA-MM-DD` no fuso local** | Evita o erro clássico de dia trocado por fuso horário. |
| D13 | **Acessibilidade e tema** | Cor de status sempre com ícone + texto; tema claro/escuro; tabela junto dos gráficos; sem rolagem lateral no celular. |

**Entregas da fase 1:**
- código em https://github.com/correaaugusto/caixa-claro (público, branch `main`);
- PDF do pitch com 11 slides;
- `README.md` com roteiro de demonstração.

**Deploy:** a Vercel não pôde ser acessada deste ambiente (rede bloqueada, sem token). O caminho recomendado é importar o repositório em vercel.com/new: o framework Vite é detectado sozinho, o build é `npm run build` e a pasta de saída é `dist`.

---

## 4. Fase 2: dados automáticos do banco

### D14. O usuário não deve precisar digitar
**Pedido do usuário:** "que o usuário não precise colocar dados e que seja tudo o mais automático possível, puxando os dados do banco de preferência do usuário".
**Decisão:** o dono **conecta o banco uma vez**, e entradas, saídas, retiradas e contas fixas passam a vir do extrato. O lançamento manual continua existindo **só para dinheiro vivo**, que não passa pelo banco.

### D15. Via Open Finance, usando a Pluggy como agregador
**Decisão:** usar a **Pluggy** (agregador autorizado de Open Finance no Brasil). O dono escolhe o próprio banco no widget **Pluggy Connect** e autoriza no app do banco.

**Por quê:**
- Só instituições autorizadas pelo Banco Central acessam o Open Finance diretamente. Um app como o nosso precisa de um agregador.
- A Pluggy tem SDK oficial em Node (`pluggy-sdk`), widget pronto em React (`react-pluggy-connect`) e ambiente de testes (sandbox) gratuito.
- **Alternativa considerada:** Belvo, que tem papel equivalente. Escolhemos a Pluggy pelo SDK oficial e pelo widget pronto.

**Como verificamos a API:** o site de documentação da Pluggy estava bloqueado pela rede deste ambiente. Por isso o formato **não foi tirado de memória**: foi conferido nos tipos do SDK oficial `pluggy-sdk@0.94.0` (publicado em 28/10/2026). Ficaram confirmados:
- `createConnectToken(itemId?, { webhookUrl, clientUserId, ... })` devolve `{ accessToken }`;
- `fetchItem`, `updateItem`, `fetchAccounts(itemId, 'BANK')` e `fetchAllTransactions(accountId, { dateFrom })`;
- os campos da transação: `type` (`DEBIT`/`CREDIT`), `amount`, `date`, `description`, `category`, `status` (`PENDING`/`POSTED`), `paymentData.payer/receiver` (com `documentNumber`) e `merchant`;
- os campos da conta: `balance`, `owner` e `taxNumber`;
- o status do item: `UPDATED`, `UPDATING`, `LOGIN_ERROR`, `OUTDATED`…;
- o evento de webhook `transactions/created`.

O widget foi conferido no README do `react-pluggy-connect@2.12.0`: `<PluggyConnect connectToken onSuccess={({ item }) => item.id} includeSandbox />`.

### D16. Um servidor mínimo (funções na Vercel), sem banco de dados
**Decisão:** três funções em `api/`, que a Vercel publica junto com o site.

| Função | O que faz |
|---|---|
| `GET /api/pluggy-status` | Diz se as chaves da Pluggy estão configuradas (e se o modo sandbox está ligado). |
| `POST /api/pluggy-token` | Cria o *connect token* para abrir o widget. **A chave secreta nunca vai para o celular.** |
| `GET /api/pluggy-sync?itemId=…` | Busca as contas e as transações (últimos 120 dias) e devolve já normalizadas. |
| `POST /api/pluggy-sync?itemId=…` | Pede ao banco uma atualização agora (`updateItem`). O app consulta de novo até o status sair de `UPDATING`. |

**Chaves:** ficam em variáveis de ambiente na Vercel (`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_SANDBOX=1` para testes).

**Por que sem banco de dados:** o app continua guardando os dados no aparelho (D10). O servidor só faz a ponte com a Pluggy. Isso mantém o MVP simples e barato.

**Sem as chaves configuradas** (ou rodando com `npm run dev`), o botão vira **"Conectar banco de demonstração"**. Ele gera um extrato simulado no mesmo formato da Pluggy e o passa pelo **mesmo processamento** da conexão real.

### D17. Quando os dados chegam: automático, mas não instantâneo
**Decisão:** o app sincroniza **sozinho ao abrir** (se a última sincronização tiver mais de 1 h) e tem o botão **"Atualizar agora"**.

**Por quê:** no Open Finance, a atualização é feita pelo agregador em ciclos, normalmente sem tempo real por transação. A frequência depende do provedor e do plano, e precisa ser confirmada com a Pluggy. Para a previsão de 30 dias e o aviso diário isso basta.

**Tempo real "a cada transação":** é possível via webhook `transactions/created`, mas exige um **banco de dados** (para guardar o que chegou) e **notificação push** (para avisar o celular). Isso está planejado como fase 3 (seção 8). Para recebimentos, contas PJ com API própria (Inter PJ, Efí, Asaas, Mercado Pago) avisam cada Pix na hora. Fica como opção futura.

---

## 5. Como o extrato vira informação (sem digitar)

Código em `src/lib/banco.js`. São funções puras, testadas.

### 5.1 Normalização
- Converte a transação da Pluggy para o formato do app: data no **fuso de Brasília**, para que uma compra às 22h não caia no dia seguinte.
- Usa o valor absoluto + crédito/débito.
- Pega o favorecido ou pagador (nome e CPF/CNPJ), vindo de `paymentData` ou `merchant`.
- Transações **pendentes** são ignoradas até serem confirmadas.

### 5.2 Classificação automática (nesta ordem)
1. **Regra aprendida:** o dono já confirmou esse favorecido antes (ver 5.5).
2. **Dinheiro do próprio dono:**
   - Pix/TED para o **CPF ou nome do titular** é **retirada pessoal**. Ataca direto a dor nº 1 da pesquisa.
   - Crédito vindo do próprio dono é **aporte**: aumenta o caixa, mas **não conta como venda**.
3. **Palavras-chave do nome:**
   - CEMIG, ENEL, SABESP, VIVO… → Energia/água/internet
   - DAS, Simples Nacional, DARF → Impostos
   - Aluguel, imobiliária → Aluguel
   - Distribuidora, atacado → Fornecedor
   - Conserto, assistência técnica → Manutenção
   - Tarifas e limpeza → Outros
4. **Parece pessoal** (farmácia, iFood, Netflix, mercado…): sugere retirada, mas **pede confirmação**.
5. **Categoria sugerida pela própria Pluggy:** usada só como pista.
6. **Não reconhecido:** fica como "Outros" e **pede confirmação**.

**Créditos:** recebimento de cliente vira **Vendas**; rendimento vira **Outros**; estorno vira **Outros**, com confirmação.

### 5.3 Contas fixas descobertas sozinhas
Um mesmo favorecido é tratado como conta fixa quando foi pago:
- **1 vez por mês**, em **2 meses ou mais**;
- com **valor parecido** (±20%) e **dia parecido**.

Nesse caso o app cria sozinho a **próxima conta**, com vencimento previsto. Isso resolve o "só sei as contas do próximo mês" **sem cadastro**.
- Os pagamentos dessas contas saem da média de gastos do dia a dia, para não contar duas vezes na previsão.
- Se o dono apagar uma conta detectada, aquela série não é recriada.

### 5.4 Baixa automática
- Uma conta em aberto é marcada como **paga** quando aparece no extrato uma saída do mesmo favorecido (ou com o valor exato) até 10 dias antes ou depois do vencimento.
- Se for recorrente, a do mês seguinte é criada.
- **Sem duplicar:** se o dono já tinha tocado em "Pagar" à mão, o lançamento manual é **trocado** pelo do banco.

### 5.5 "Confira": o único toque que sobra
- Só os lançamentos **dos últimos 30 dias** com classificação incerta aparecem num cartão "Confira" na tela inicial.
- Botões: **"É pessoal"** ou **"É do negócio"**, com a escolha da categoria.
- A escolha vale para **todos** os lançamentos daquele favorecido e vira **regra**: da próxima vez, o app já sabe.

### 5.6 Saldo
O saldo do app passa a **bater com o saldo do banco**: `saldo do banco + o que foi anotado à mão (dinheiro vivo)`.

### 5.7 Dono = titular da conta
- O titular e o CPF/CNPJ vêm da conta conectada (`owner`, `taxNumber`).
- Se a conta for PJ (CNPJ), o dono pode informar o **CPF pessoal** em Ajustes. Assim as transferências para ele também são reconhecidas como retirada.

---

## 6. Mudanças nas telas (fase 2)

| Tela | Mudança |
|---|---|
| Ajustes | Cartão **"Conta do banco"**: Conectar (real ou demonstração), banco conectado, última atualização, Atualizar agora, Desconectar. Campo "Seu CPF". |
| Início | Linha "Banco X · atualizado há N min". Cartão **"Confira N lançamentos"**. Os botões Entrou/Saiu passam a ser "para dinheiro vivo". |
| Confira (nova) | Lista do que precisa de confirmação, com 1 toque por item. |
| Lançar | Aviso "o que passa pelo banco entra sozinho; anote aqui só o dinheiro vivo". Ícone de banco nos lançamentos importados. |
| Contas | Selo "detectada automaticamente" e "paga pelo banco". |
| Demonstração | Passa a ser um **banco de demonstração conectado**: o extrato simulado (Pix de clientes, boletos CEMIG/SABESP, DAS, Pix para o dono, farmácia, iFood…) passa pelo mesmo processamento. |

---

## 7. Segurança, privacidade e limites (LGPD)

- A **chave secreta** da Pluggy fica só no servidor. O celular recebe apenas um token de conexão temporário.
- **O acesso é somente leitura:** o app não movimenta dinheiro.
- O dono autoriza no app do próprio banco e pode revogar a qualquer momento.
- O extrato fica **só no aparelho**. O servidor não guarda nada.
- O service worker (que faz o app abrir offline) **nunca guarda respostas do `/api` em cache**. Isso foi corrigido depois de aparecer no teste ponta a ponta.

**Limitações conhecidas do MVP (precisam ser resolvidas antes de uso real):**
- **Sem login:** o identificador da conexão (`itemId`) funciona como "senha". Quem o tiver consegue ler o extrato pela função `pluggy-sync`. Em produção é preciso login e vincular o `itemId` ao usuário no servidor.
- **Termo de consentimento:** falta o termo em linguagem clara e a política de privacidade.
- **Custo:** o uso real da Pluggy é pago por conexão. O sandbox é gratuito.
- **Dinheiro vivo e conta pessoal:** vendas em dinheiro não aparecem no banco. E quem usa a conta pessoal para o negócio vai ver gastos de casa no extrato; o "Confira" e as regras resolvem isso com o tempo.

---

## 8. Próximas fases

- **Fase 3, tempo real:** webhook `transactions/created`, banco de dados e notificação push. Aviso no celular a cada entrada ou saída.
- **Boletos registrados (DDA):** contas futuras aparecem antes do pagamento, sem cadastro.
- **WhatsApp:** aviso diário e "gastei 50 de luz" por mensagem.
- **Calculadora de preço do serviço:** dor "cobrar o valor certo".
- **Login e sincronização entre aparelhos.**

---

## 9. Status da implementação da fase 2

| Parte | Status |
|---|---|
| Verificar a API da Pluggy (pelo SDK oficial) | ✅ feito |
| Instalar `pluggy-sdk@0.94.0` e `react-pluggy-connect@2.12.0` | ✅ feito |
| Tipo "aporte" no cálculo do saldo | ✅ feito |
| `src/lib/banco.js`: normalização, classificação, contas fixas, baixa automática, Confira | ✅ feito, 9 testes |
| Demonstração como "banco conectado" | ✅ feito |
| Funções `api/` (status, token, sync) | ✅ feito, 6 testes com um cliente Pluggy simulado |
| Telas: Conta do banco, Confira, avisos e selos | ✅ feito |
| Teste ponta a ponta no navegador | ✅ demonstração, Confira e sincronização automática ao abrir (com `/api` simulado) |
| Service worker sem cache do `/api` (privacidade do extrato) | ✅ corrigido, encontrado no teste |
| README e PDF do pitch | ✅ atualizados (PDF com o novo slide "Zero digitação") |
| Envio desta versão ao GitHub | ✅ feito |
| Teste com a Pluggy de verdade (sandbox) | ⏳ precisa das chaves e de rede liberada (ver abaixo) |

**Para ativar a conexão real depois do deploy:**
1. Crie uma conta em pluggy.ai e copie o *Client ID* e o *Client Secret* (de teste ou de produção).
2. Na Vercel: Project → Settings → Environment Variables. Cadastre `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` e, para testes, `PLUGGY_SANDBOX=1`.
3. Faça um novo deploy e toque em **Ajustes → Conectar meu banco**. No sandbox, escolha o banco de testes da Pluggy.

A conexão real ainda não foi testada deste ambiente, porque a rede bloqueia a Pluggy e não há chaves. O processamento foi testado com o extrato simulado, no mesmo formato.
