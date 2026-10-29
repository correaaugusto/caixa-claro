// Dados SIMULADOS para demonstração, baseados no perfil do "grupo B" da pesquisa:
// pet shop, dono trabalha sozinho, faturamento até ~R$ 10 mil/mês, anota no caderno
// e mistura dinheiro pessoal com o da empresa.
import { somarDias, somarMeses, mesDe, mesAnterior, deISO, diferencaDias } from './datas.js';
import { projecao } from './financas.js';

// Gerador pseudoaleatório com semente: a demo é sempre igual para a mesma data.
function aleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CONTAS_FIXAS = [
  { descricao: 'Aluguel da loja', valor: 1200, categoria: 'Aluguel', dia: 10 },
  { descricao: 'Energia', valor: 260, categoria: 'Energia/água/internet', dia: 15 },
  { descricao: 'Água + internet', valor: 140, categoria: 'Energia/água/internet', dia: 20 },
  { descricao: 'DAS do MEI', valor: 76, categoria: 'Impostos', dia: 20 },
];

export function gerarDemo(hoje) {
  const rnd = aleatorio(Number(hoje.replaceAll('-', '')));
  let seq = 0;
  const id = () => `demo-${++seq}`;
  const lancamentos = [];
  const contas = [];
  const mesAtual = mesDe(hoje);
  const inicio = `${mesAnterior(mesAtual, 3)}-01`;
  const centavos = (v) => Math.round(v * 100) / 100;

  // Movimento do dia a dia
  for (let d = inicio; d <= hoje; d = somarDias(d, 1)) {
    const semana = deISO(d).getDay();
    const doMesAtual = mesDe(d) === mesAtual;
    if (semana !== 0) {
      // Vendas (ração, acessórios) e serviços (banho e tosa); sábado é o dia mais forte.
      // No mês atual o movimento está um pouco mais fraco.
      const fator = (semana === 6 ? 1.5 : 1) * (doMesAtual ? 0.9 : 1);
      lancamentos.push({ id: id(), tipo: 'entrada', valor: centavos((150 + rnd() * 110) * fator), categoria: 'Vendas', descricao: 'Vendas do dia', data: d });
      if (rnd() < 0.75)
        lancamentos.push({ id: id(), tipo: 'entrada', valor: centavos((60 + rnd() * 70) * fator), categoria: 'Serviços', descricao: 'Banho e tosa', data: d });
    }
    // Reposição de mercadoria pago à vista, toda segunda
    if (semana === 1)
      lancamentos.push({ id: id(), tipo: 'saida', valor: centavos(520 + rnd() * 180), categoria: 'Fornecedor', descricao: 'Reposição de mercadoria', data: d });
    // Retiradas pessoais: o dono tira dinheiro do caixa algumas vezes por semana
    if (semana !== 0 && rnd() < 0.45)
      lancamentos.push({ id: id(), tipo: 'retirada', valor: centavos(120 + rnd() * 160), categoria: 'Retirada pessoal', descricao: 'Retirada', data: d });
    // Pequenas manutenções esporádicas
    if (rnd() < 0.04)
      lancamentos.push({ id: id(), tipo: 'saida', valor: centavos(40 + rnd() * 60), categoria: 'Manutenção', descricao: 'Manutenção', data: d });
    if (rnd() < 0.05)
      lancamentos.push({ id: id(), tipo: 'saida', valor: centavos(30 + rnd() * 50), categoria: 'Outros', descricao: 'Material de limpeza', data: d });
  }

  // Situações do mês atual que o app deve detectar
  const dia1 = `${mesAtual}-01`;
  const quandoNoMes = (n) => (somarDias(dia1, n) <= hoje ? somarDias(dia1, n) : hoje);
  lancamentos.push({ id: id(), tipo: 'saida', valor: 480, categoria: 'Manutenção', descricao: 'Conserto do secador da tosa', data: quandoNoMes(3) });
  lancamentos.push({ id: id(), tipo: 'retirada', valor: 1400, categoria: 'Retirada pessoal', descricao: 'Conserto do carro (pessoal)', data: quandoNoMes(5) });
  if (diferencaDias(dia1, hoje) >= 0)
    lancamentos.push({ id: id(), tipo: 'entrada', valor: 210, categoria: 'Vendas', descricao: 'Vendas do dia', data: hoje });

  // Contas fixas recorrentes: meses passados pagos, a próxima em aberto
  for (const f of CONTAS_FIXAS) {
    let venc = `${mesAnterior(mesAtual, 3)}-${String(f.dia).padStart(2, '0')}`;
    while (venc < hoje) {
      const cId = id();
      contas.push({ id: cId, descricao: f.descricao, valor: f.valor, categoria: f.categoria, vencimento: venc, recorrente: true, paga: true, pagaEm: venc });
      lancamentos.push({ id: id(), tipo: 'saida', valor: f.valor, categoria: f.categoria, descricao: f.descricao, data: venc, contaId: cId });
      venc = somarMeses(venc, 1);
    }
    contas.push({ id: id(), descricao: f.descricao, valor: f.valor, categoria: f.categoria, vencimento: venc, recorrente: true, paga: false });
  }
  // Boletos de fornecedor (não recorrentes): um vence amanhã, outro daqui a 12 dias
  contas.push({ id: id(), descricao: 'Boleto petiscos e areia', valor: 420, categoria: 'Fornecedor', vencimento: somarDias(hoje, 1), recorrente: false, paga: false });
  contas.push({ id: id(), descricao: 'Boleto ração (distribuidora)', valor: 1650, categoria: 'Fornecedor', vencimento: somarDias(hoje, 12), recorrente: false, paga: false });

  const dados = {
    config: { nomeNegocio: 'Pet Shop Amigo Fiel', saldoInicial: 0, demo: true },
    lancamentos: lancamentos.sort((a, b) => a.data.localeCompare(b.data)),
    contas,
  };

  // Ajusta o saldo inicial para que o caixa de hoje esteja positivo, mas a previsão
  // mostre que vai faltar dinheiro (cenário típico relatado na pesquisa).
  const menor = Math.min(...projecao(dados, hoje).pontos.map((p) => p.saldo));
  dados.config.saldoInicial = Math.round(-menor - 450);
  return dados;
}
