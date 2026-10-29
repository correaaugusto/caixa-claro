# Caixa Claro: Desafio 2, Gestor Inteligente de Pequenos Negócios

> "Em 10 segundos você anota, e todo dia o Caixa Claro te diz o que vence amanhã, quanto sobrou hoje e se o dinheiro vai faltar nos próximos 30 dias."

App web mobile-first (PWA: abre no celular como app) para o pequeno empresário que trabalha sozinho e anota no caderno. Foco único: **previsão de caixa + alerta diário**.

## Como rodar

Precisa do Node.js 18 ou superior.

```bash
npm install
```

```bash
npm run dev
```

Abra o endereço que aparecer (ex.: `http://localhost:5173`). Para abrir no celular, use o endereço "Network" mostrado no terminal (o celular precisa estar na mesma rede Wi-Fi).

Outros comandos:

```bash
npm test
```

```bash
npm run build && npm run preview
```

`npm test` roda os testes das regras financeiras. `npm run build` gera a versão final em `dist/`, que pode ser publicada em qualquer hospedagem estática (Netlify, Vercel, GitHub Pages).

Na primeira abertura o app carrega uma **demonstração com dados simulados**: um pet shop de 1 pessoa com ~R$ 8 mil/mês, que é o perfil do "grupo B" da pesquisa. Em *Ajustes* dá para apagar tudo e começar com dados reais.

## Fluxo pedido no desafio

| Etapa do desafio | No Caixa Claro |
|---|---|
| **Entrada de dados** | Botões grandes *Entrou / Saiu / Tirei para mim*: valor + 1 toque na categoria. Cadastro de contas e boletos com vencimento e opção "repete todo mês". |
| **Organização** | Categorias fixas (Fornecedor, Aluguel, Energia/água/internet, Impostos, Salários, Manutenção, Outros). Retirada pessoal fica separada das despesas do negócio. |
| **Indicadores** | Entrou/saiu/sobrou do dia e do mês, lucro do negócio x retiradas, maiores gastos, evolução de 4 meses, total a pagar em 30/60/90 dias e saldo projetado dia a dia. |
| **Informação útil para decisão** | Semáforo (verde/amarelo/vermelho), alertas em linguagem simples com sugestão e simulador "E se…?" (retirar menos / vender mais). |

Perguntas do desafio e onde cada uma é respondida:

- *Quanto entrou e quanto saiu?* → Início (resumo de hoje) e Previsão (mês)
- *Quais são os principais gastos?* → Previsão: "Maiores gastos do mês"
- *Existem contas próximas do vencimento?* → Resumo de hoje ("Amanhã vence") e tela Contas
- *O caixa é suficiente para os próximos compromissos?* → Semáforo + gráfico de 30 dias
- *O resultado está melhorando ou piorando?* → Alerta "Resultado piorando" + gráfico mensal
- *Existe situação que exige atenção?* → Lista "Precisa de atenção"

## Funcionalidades (5)

1. **Lançamento rápido**: meta de menos de 10 segundos.
2. **Separação pessoal x empresa**: "Tirei dinheiro para mim" registra a retirada. O app compara *quanto o negócio lucrou* com *quanto você retirou*.
3. **Contas a pagar com vencimento**: contas recorrentes se repetem sozinhas. Ao pagar, a saída entra no caixa e a conta do mês seguinte é criada.
4. **Previsão de caixa de 30 dias**: gráfico do saldo dia a dia e semáforo.
5. **Aviso diário**: tela "Resumo de hoje" + notificação do navegador (uma vez por dia, ao abrir o app).

## A "inteligência": regras de alerta

Toda a lógica fica em [`src/lib/financas.js`](src/lib/financas.js) (funções puras, testadas em `tests/`).

**Previsão:** `saldo(dia) = saldo(dia anterior) + média diária de entradas − média de gastos do dia a dia − média de retiradas − contas que vencem no dia`. As médias usam os últimos 30 dias. Saídas de contas pagas não entram na média, porque as contas já são projetadas pelo vencimento e entrariam duas vezes.

| Alerta | Regra |
|---|---|
| Conta atrasada / vence hoje / vence amanhã | vencimento < hoje, = hoje, = amanhã |
| Caixa vai faltar (vermelho) | saldo projetado < 0 em algum dia dos próximos 30. Sugere reduzir retiradas ou negociar a maior conta |
| Caixa apertado (amarelo) | caixa de hoje < contas dos próximos 7 dias, **ou** no pior dia sobra menos que 1 semana de gastos + retiradas |
| Retirada acima do lucro | retiradas do mês > (entradas − saídas do mês) |
| Gasto fora do padrão | categoria no mês > 130% da média dos até 3 meses anteriores |
| Resultado piorando | lucro do mês até hoje < lucro do mesmo período do mês anterior |

## Telas

1. **Início**: semáforo, botões Entrou/Saiu/Pra mim, resumo de hoje, alertas, "Negócio x bolso"
2. **Lançar**: valor, categoria, data, últimos lançamentos
3. **Contas**: total a pagar em 30/60/90 dias, lista por vencimento, botão Pagar
4. **Previsão**: gráfico de 30 dias, "como calculamos", simulador "E se…?", gastos do mês, evolução mensal
5. **Ajustes**: nome, dinheiro em caixa hoje, aviso diário, exportar CSV, demonstração/apagar tudo

## Base na pesquisa (6 respostas)

Público-alvo: o **grupo B** (4 de 6), formado por quem fatura até R$ 30 mil e anota no caderno ou de cabeça.

- 4/4 sabem entradas e saídas só "mais ou menos" → lançamento rápido + indicadores prontos
- 4/4 misturam dinheiro pessoal e da empresa → "Tirei para mim" + alerta de retirada acima do lucro
- 3/4 só sabem as contas do próximo mês → contas recorrentes + visão de 30/60/90 dias
- 2/4 gastam de 30 min a 1 h por dia conferindo cadernos → anotar em menos de 10 s
- 5/6 deram nota 5 para "app que avisa se o caixa vai faltar em 30 dias" → foco na previsão
- Ninguém vende fiado → contas a receber ficaram fora

*Limitação:* a amostra é pequena (6 respostas), então o resultado é indicativo, não estatístico.

## O que fica fora (de propósito)

Fiado e contas a receber (ninguém vende fiado), nota fiscal, estoque, folha de pagamento e integração bancária. O desafio pede foco e não um ERP.

**Evolução futura:** lançamento por WhatsApp ou voz ("gastei 50 de luz"), aviso diário pelo WhatsApp em horário fixo, calculadora de preço do serviço (dor "cobrar o valor certo"), foto do caderno virando lançamentos (OCR/IA) e sincronização na nuvem com login.

## Tecnologia

React 18 + Vite, Tailwind CSS 4, Recharts (gráficos). Os dados ficam salvos no próprio aparelho (`localStorage`), sem servidor e sem login no MVP. Há um service worker simples para funcionar offline e mostrar a notificação.

```
src/
  lib/financas.js      regras: saldo, médias, projeção, semáforo, alertas
  lib/demo.js          dados simulados (pet shop, grupo B da pesquisa)
  lib/datas.js         datas em AAAA-MM-DD (sem problema de fuso)
  lib/formato.js       moeda em R$ e leitura de "1.200,50"
  lib/aviso.js         notificação do aviso diário
  lib/armazenamento.js salvar/carregar, exportar CSV
  telas/               Inicio, Lancar, Contas, Previsao, Ajustes
  componentes/         semáforo, alertas, ícones
tests/financas.test.js testes das regras (node --test)
```

## Roteiro de demonstração para a banca (cerca de 3 min)

1. **Início**: "O semáforo está vermelho: vai faltar dinheiro no dia X." Mostrar o resumo de hoje (amanhã vence o boleto) e os alertas: retirou mais do que lucrou, gasto alto com Manutenção, resultado piorando.
2. **Lançar**: tocar em *Entrou*, digitar 350, tocar em *Serviços* e em *Anotar*. Leva menos de 10 segundos.
3. **Contas**: mostrar o total de 30/60/90 dias e pagar o boleto de amanhã. A conta sai da lista e entra no caixa.
4. **Previsão**: no gráfico, a queda no dia do aluguel + boleto da ração. No *E se…?*, arrastar "Retirar menos por mês" e ver a linha verde e o semáforo mudarem. **Este é o momento da decisão.**
5. Fechar com o argumento: "Ouvimos 6 pequenos empresários. Os que mais precisam anotam no caderno, misturam o dinheiro e só enxergam o próximo mês. 5 de 6 dariam nota máxima para um app que avisa se o caixa vai faltar. O Caixa Claro faz isso bem feito."

**Origem dos dados:** a demonstração usa dados **simulados**, gerados por `src/lib/demo.js` a partir do perfil do grupo B da pesquisa.
