// Regras de negócio do Caixa Claro. Funções puras: recebem os dados e a data de hoje,
// devolvem números e alertas. Nada aqui depende da interface.
import { somarDias, somarMeses, mesDe, mesAnterior, diferencaDias, diaMes } from './datas.js';
import { reaisCurto } from './formato.js';

export const CATEGORIAS_SAIDA = [
  'Fornecedor',
  'Aluguel',
  'Energia/água/internet',
  'Impostos',
  'Salários',
  'Manutenção',
  'Outros',
];
export const CATEGORIAS_ENTRADA = ['Vendas', 'Serviços', 'Outros'];
export const CATEGORIA_RETIRADA = 'Retirada pessoal';

const JANELA_MEDIA = 30; // dias usados para a média de entradas e gastos do dia a dia
const LIMITE_GASTO_FORA_PADRAO = 1.3; // 130% da média dos meses anteriores

const soma = (lista) => lista.reduce((t, l) => t + l.valor, 0);

function sinal(l) {
  return l.tipo === 'entrada' ? l.valor : -l.valor;
}

export function saldoAtual(dados, hoje) {
  return dados.lancamentos
    .filter((l) => l.data <= hoje)
    .reduce((t, l) => t + sinal(l), dados.config.saldoInicial || 0);
}

// Totais de um intervalo [de, ate].
export function totais(lancamentos, de, ate) {
  const doPeriodo = lancamentos.filter((l) => l.data >= de && l.data <= ate);
  const entrou = soma(doPeriodo.filter((l) => l.tipo === 'entrada'));
  const saiu = soma(doPeriodo.filter((l) => l.tipo === 'saida'));
  const retiradas = soma(doPeriodo.filter((l) => l.tipo === 'retirada'));
  return { entrou, saiu, retiradas, lucro: entrou - saiu };
}

export function totaisMes(lancamentos, mes) {
  return totais(lancamentos, `${mes}-01`, `${mes}-31`);
}

// Médias diárias dos últimos 30 dias (ou desde o primeiro lançamento, se for mais recente).
// Saídas que vieram do pagamento de uma conta não entram na média: as contas já são
// projetadas pela data de vencimento, e contá-las duas vezes deixaria a previsão pessimista.
export function mediasDiarias(dados, hoje) {
  const lancs = dados.lancamentos.filter((l) => l.data <= hoje);
  if (!lancs.length) return { entrada: 0, gastoVariavel: 0, retirada: 0, dias: 0 };
  const primeiro = lancs.reduce((m, l) => (l.data < m ? l.data : m), hoje);
  const dias = Math.min(JANELA_MEDIA, diferencaDias(primeiro, hoje) + 1);
  const inicio = somarDias(hoje, -(dias - 1));
  const janela = lancs.filter((l) => l.data >= inicio);
  return {
    entrada: soma(janela.filter((l) => l.tipo === 'entrada')) / dias,
    gastoVariavel: soma(janela.filter((l) => l.tipo === 'saida' && !l.contaId)) / dias,
    retirada: soma(janela.filter((l) => l.tipo === 'retirada')) / dias,
    dias,
  };
}

// Todas as contas em aberto até a data limite. Contas recorrentes se repetem a cada mês
// (as ocorrências futuras aparecem como "previstas" enquanto a atual não for paga).
export function contasEmAberto(contas, ate) {
  const lista = [];
  for (const c of contas) {
    if (c.paga) continue;
    let venc = c.vencimento;
    let prevista = false;
    while (venc <= ate) {
      lista.push({ ...c, vencimento: venc, prevista });
      if (!c.recorrente) break;
      venc = somarMeses(c.vencimento, lista.filter((x) => x.id === c.id).length);
      prevista = true;
    }
  }
  return lista.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

// Saldo projetado dia a dia: hoje + 30 dias.
// saldo(d) = saldo(d-1) + média de entradas - média de gastos do dia a dia - média de retiradas - contas que vencem em d
// Contas atrasadas ou que vencem hoje são descontadas já no dia 0.
export function projecao(dados, hoje, dias = 30, ajustes = {}) {
  const medias = mediasDiarias(dados, hoje);
  const retiradaDia = Math.max(0, medias.retirada - (ajustes.menosRetiradaMes || 0) / 30);
  const liquidoDia =
    medias.entrada + (ajustes.maisEntradaMes || 0) / 30 - medias.gastoVariavel - retiradaDia;
  const ate = somarDias(hoje, dias);
  const contas = contasEmAberto(dados.contas, ate);

  let saldo = saldoAtual(dados, hoje);
  const pontos = [];
  for (let i = 0; i <= dias; i++) {
    const data = somarDias(hoje, i);
    const doDia = contas.filter((c) => (i === 0 ? c.vencimento <= data : c.vencimento === data));
    if (i > 0) saldo += liquidoDia;
    saldo -= soma(doDia);
    pontos.push({ data, saldo: Math.round(saldo * 100) / 100, contas: doDia });
  }
  return { pontos, medias, liquidoDia, retiradaDia, contas };
}

// Semáforo: VERMELHO se o saldo projetado fica negativo em algum dia;
// AMARELO se o caixa de hoje não cobre as contas dos próximos 7 dias, ou se no pior dia
// sobra menos que uma semana de gastos do dia a dia + retiradas;
// VERDE caso contrário.
export function semaforo(dados, hoje, proj = projecao(dados, hoje)) {
  const negativo = proj.pontos.find((p) => p.saldo < 0);
  const menor = proj.pontos.reduce((m, p) => (p.saldo < m.saldo ? p : m), proj.pontos[0]);
  const contas7 = soma(proj.contas.filter((c) => c.vencimento <= somarDias(hoje, 7)));
  const saldo = saldoAtual(dados, hoje);

  if (negativo) {
    return {
      cor: 'vermelho',
      titulo: `Vai faltar dinheiro em ${diaMes(negativo.data)}`,
      texto: `No pior dia (${diaMes(menor.data)}) o caixa fica em ${reaisCurto(menor.saldo)}.`,
      primeiroNegativo: negativo,
      menor,
    };
  }
  if (saldo < contas7) {
    return {
      cor: 'amarelo',
      titulo: 'Caixa apertado',
      texto: `Você tem ${reaisCurto(saldo)} hoje e ${reaisCurto(contas7)} em contas nos próximos 7 dias.`,
      menor,
    };
  }
  const reservaSemana = (proj.medias.gastoVariavel + proj.retiradaDia) * 7;
  if (menor.saldo < reservaSemana) {
    return {
      cor: 'amarelo',
      titulo: 'Caixa apertado',
      texto: `No pior dia (${diaMes(menor.data)}) sobram só ${reaisCurto(menor.saldo)}, menos que uma semana dos seus gastos (${reaisCurto(reservaSemana)}).`,
      menor,
    };
  }
  return {
    cor: 'verde',
    titulo: 'Caixa cobre tudo',
    texto: `Pelo seu ritmo atual, o menor saldo nos próximos 30 dias é ${reaisCurto(menor.saldo)}.`,
    menor,
  };
}

// Alertas em linguagem simples. nivel: 'alto' | 'medio' | 'info'
export function alertas(dados, hoje) {
  const lista = [];
  const proj = projecao(dados, hoje);
  const amanha = somarDias(hoje, 1);
  const mes = mesDe(hoje);
  const doMes = totais(dados.lancamentos, `${mes}-01`, hoje);

  // 1) Contas atrasadas e vencendo amanhã
  const atrasadas = dados.contas.filter((c) => !c.paga && c.vencimento < hoje);
  if (atrasadas.length) {
    lista.push({
      id: 'atrasada',
      nivel: 'alto',
      titulo: `${atrasadas.length === 1 ? 'Conta atrasada' : `${atrasadas.length} contas atrasadas`}`,
      texto: atrasadas.map((c) => `${c.descricao} ${reaisCurto(c.valor)} (venceu ${diaMes(c.vencimento)})`).join(' · '),
    });
  }
  const venceHoje = dados.contas.filter((c) => !c.paga && c.vencimento === hoje);
  if (venceHoje.length) {
    lista.push({
      id: 'hoje',
      nivel: 'alto',
      titulo: 'Vence hoje',
      texto: venceHoje.map((c) => `${c.descricao} ${reaisCurto(c.valor)}`).join(' · '),
    });
  }
  const venceAmanha = proj.contas.filter((c) => c.vencimento === amanha);
  if (venceAmanha.length) {
    lista.push({
      id: 'amanha',
      nivel: 'medio',
      titulo: 'Amanhã vence',
      texto: venceAmanha.map((c) => `${c.descricao} ${reaisCurto(c.valor)}`).join(' · '),
    });
  }

  // 2) Caixa vai faltar / apertado
  const sem = semaforo(dados, hoje, proj);
  if (sem.cor === 'vermelho') {
    const deficit = -sem.menor.saldo;
    const ateNegativo = proj.contas.filter((c) => c.vencimento <= sem.primeiroNegativo.data);
    const maiorConta = ateNegativo.reduce((m, c) => (!m || c.valor > m.valor ? c : m), null);
    const sugestoes = [];
    if (proj.medias.retirada * 30 >= deficit)
      sugestoes.push(`reduzir suas retiradas em ${reaisCurto(deficit)} neste mês`);
    if (maiorConta) sugestoes.push(`negociar o vencimento de "${maiorConta.descricao}" (${reaisCurto(maiorConta.valor)})`);
    lista.push({
      id: 'faltar',
      nivel: 'alto',
      titulo: 'O caixa vai faltar',
      texto: `No dia ${diaMes(sem.primeiroNegativo.data)} o caixa pode ficar negativo. No pior dia (${diaMes(sem.menor.data)}) faltam ${reaisCurto(deficit)}.`,
      sugestao: sugestoes.length ? `Sugestão: ${sugestoes.join(' ou ')}.` : undefined,
    });
  } else if (sem.cor === 'amarelo') {
    lista.push({ id: 'apertado', nivel: 'medio', titulo: sem.titulo, texto: sem.texto });
  }

  // 3) Retirada acima do lucro (dinheiro pessoal x empresa)
  if (doMes.retiradas > 0 && doMes.retiradas > doMes.lucro) {
    lista.push({
      id: 'retirada',
      nivel: 'alto',
      titulo: 'Você retirou mais do que o negócio lucrou',
      texto: `Neste mês o negócio lucrou ${reaisCurto(doMes.lucro)}, mas você retirou ${reaisCurto(doMes.retiradas)} para uso pessoal.`,
      sugestao: `A diferença de ${reaisCurto(doMes.retiradas - doMes.lucro)} está saindo do caixa da empresa.`,
    });
  }

  // 4) Gasto fora do padrão por categoria
  for (const g of gastosForaDoPadrao(dados.lancamentos, hoje)) {
    lista.push({
      id: `padrao-${g.categoria}`,
      nivel: 'medio',
      titulo: `Gasto alto com ${g.categoria}`,
      texto: `Neste mês já foram ${reaisCurto(g.atual)}, contra uma média de ${reaisCurto(g.media)} nos meses anteriores (+${Math.round((g.atual / g.media - 1) * 100)}%).`,
    });
  }

  // 5) Resultado piorando (compara com o mesmo período do mês anterior)
  const comp = comparacaoMesAnterior(dados.lancamentos, hoje);
  if (comp.temHistorico && comp.atual.lucro < comp.anterior.lucro) {
    lista.push({
      id: 'piorando',
      nivel: 'info',
      titulo: 'Resultado piorando',
      texto: `Até hoje o lucro do mês é ${reaisCurto(comp.atual.lucro)}. No mesmo período do mês passado era ${reaisCurto(comp.anterior.lucro)}.`,
    });
  }

  const ordem = { alto: 0, medio: 1, info: 2 };
  return lista.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}

export function gastosForaDoPadrao(lancamentos, hoje, mesesHistorico = 3) {
  const mes = mesDe(hoje);
  const atual = gastosPorCategoria(lancamentos, `${mes}-01`, hoje);
  const anteriores = [];
  for (let i = 1; i <= mesesHistorico; i++) {
    const m = mesAnterior(mes, i);
    if (lancamentos.some((l) => mesDe(l.data) === m)) anteriores.push(gastosPorCategoria(lancamentos, `${m}-01`, `${m}-31`));
  }
  if (!anteriores.length) return [];
  const resultado = [];
  for (const { categoria, valor } of atual) {
    const media = anteriores.reduce((t, a) => t + (a.find((x) => x.categoria === categoria)?.valor || 0), 0) / anteriores.length;
    if (media > 0 && valor > media * LIMITE_GASTO_FORA_PADRAO) resultado.push({ categoria, atual: valor, media });
  }
  return resultado;
}

export function gastosPorCategoria(lancamentos, de, ate) {
  const mapa = {};
  for (const l of lancamentos) {
    if (l.tipo !== 'saida' || l.data < de || l.data > ate) continue;
    mapa[l.categoria] = (mapa[l.categoria] || 0) + l.valor;
  }
  return Object.entries(mapa)
    .map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
}

export function comparacaoMesAnterior(lancamentos, hoje) {
  const mes = mesDe(hoje);
  const ant = mesAnterior(mes);
  const dia = hoje.slice(8, 10);
  return {
    temHistorico: lancamentos.some((l) => mesDe(l.data) === ant),
    atual: totais(lancamentos, `${mes}-01`, hoje),
    anterior: totais(lancamentos, `${ant}-01`, `${ant}-${dia}`),
  };
}

export function evolucaoMensal(lancamentos, hoje, meses = 4) {
  const lista = [];
  for (let i = meses - 1; i >= 0; i--) {
    const m = mesAnterior(mesDe(hoje), i);
    lista.push({ mes: m, ...totaisMes(lancamentos, m) });
  }
  return lista;
}

export function resumoDoDia(dados, hoje) {
  const t = totais(dados.lancamentos, hoje, hoje);
  const amanha = somarDias(hoje, 1);
  return {
    ...t,
    sobrou: t.entrou - t.saiu,
    contasAmanha: contasEmAberto(dados.contas, amanha).filter((c) => c.vencimento === amanha),
  };
}

// Pagar uma conta: marca como paga, registra a saída no caixa e, se for recorrente,
// cria a conta do mês seguinte.
export function pagarConta(dados, contaId, hoje, novoId) {
  const conta = dados.contas.find((c) => c.id === contaId);
  if (!conta || conta.paga) return dados;
  const contas = dados.contas.map((c) => (c.id === contaId ? { ...c, paga: true, pagaEm: hoje } : c));
  if (conta.recorrente) {
    contas.push({ ...conta, id: novoId(), vencimento: somarMeses(conta.vencimento, 1), paga: false, pagaEm: undefined });
  }
  const lancamento = {
    id: novoId(),
    tipo: 'saida',
    valor: conta.valor,
    categoria: conta.categoria,
    descricao: conta.descricao,
    data: hoje,
    contaId: conta.id,
  };
  return { ...dados, contas, lancamentos: [...dados.lancamentos, lancamento] };
}

// Texto do aviso diário (tela "Resumo de hoje" e notificação).
export function textoAvisoDiario(dados, hoje) {
  const r = resumoDoDia(dados, hoje);
  const sem = semaforo(dados, hoje);
  const linhas = [];
  if (r.contasAmanha.length)
    linhas.push(`Amanhã vence: ${r.contasAmanha.map((c) => `${c.descricao} ${reaisCurto(c.valor)}`).join(', ')}`);
  else linhas.push('Nenhuma conta vence amanhã');
  linhas.push(`Hoje sobrou ${reaisCurto(r.sobrou)} (entrou ${reaisCurto(r.entrou)}, saiu ${reaisCurto(r.saiu)})`);
  if (sem.cor === 'vermelho')
    linhas.push(`Atenção: no dia ${diaMes(sem.primeiroNegativo.data)} o caixa pode ficar negativo em ${reaisCurto(-sem.menor.saldo)}`);
  else if (sem.cor === 'amarelo') linhas.push(`Atenção: ${sem.titulo.toLowerCase()}`);
  return linhas;
}
