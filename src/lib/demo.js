// Dados SIMULADOS para demonstração, baseados no perfil do "grupo B" da pesquisa:
// pet shop, dono trabalha sozinho, faturamento até ~R$ 10 mil/mês e mistura dinheiro
// pessoal com o da empresa.
// A demonstração funciona como um "banco conectado": gera um EXTRATO no mesmo formato
// que vem do Open Finance e passa pelo mesmo processamento da conexão real
// (classificação, contas fixas descobertas, baixa automática, "Confira").
import { somarDias, mesDe, mesAnterior, deISO } from './datas.js';
import { projecao } from './financas.js';
import { importarExtrato } from './banco.js';

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

export const DONO_DEMO = { nome: 'JOAO PEREIRA DA SILVA', documento: '123.456.789-09' };
const CLIENTES = ['MARIA S OLIVEIRA', 'CARLOS A SOUZA', 'ANA P LIMA', 'BRUNO COSTA', 'JULIANA R ALVES', 'PEDRO H ROCHA', 'FERNANDA MELO', 'LUCAS GOMES'];

// Contas fixas como aparecem no extrato (o app descobre sozinho que se repetem)
const FIXAS = [
  { descricao: 'PIX ENVIADO IMOBILIARIA LAR FELIZ', parte: { nome: 'IMOBILIARIA LAR FELIZ LTDA', documento: '11.222.333/0001-44' }, valor: 1200, dia: 10 },
  { descricao: 'PAGAMENTO BOLETO CEMIG DISTRIBUICAO', valor: 260, dia: 15 },
  { descricao: 'DEB AUTOMATICO SABESP', valor: 65, dia: 20 },
  { descricao: 'DEB AUTOMATICO VIVO FIBRA', valor: 75, dia: 20 },
  { descricao: 'PAGAMENTO DAS SIMPLES NACIONAL', valor: 76, dia: 20 },
];

export function gerarExtratoDemo(hoje) {
  const rnd = aleatorio(Number(hoje.replaceAll('-', '')));
  let seq = 0;
  const brutas = [];
  const add = (data, credito, valor, descricao, contraparte = null) =>
    brutas.push({ idExterno: `demo-${++seq}`, data, credito, valor: Math.round(valor * 100) / 100, descricao, contraparte });
  const pixDono = () => ({ nome: DONO_DEMO.nome, documento: DONO_DEMO.documento });

  const mesAtual = mesDe(hoje);
  const inicio = `${mesAnterior(mesAtual, 3)}-01`;
  for (let d = inicio; d <= hoje; d = somarDias(d, 1)) {
    const semana = deISO(d).getDay();
    const fator = (semana === 6 ? 1.5 : 1) * (mesDe(d) === mesAtual ? 0.9 : 1); // mês atual mais fraco
    if (semana !== 0) {
      // Vendas: maquininha (lote do dia) + Pix de clientes (banho e tosa)
      add(d, true, (150 + rnd() * 110) * fator, 'VENDA CARTAO DEBITO/CREDITO STONE', { nome: 'STONE INSTITUICAO DE PAGAMENTO', documento: '16.501.555/0001-57' });
      if (rnd() < 0.75) {
        const cli = CLIENTES[Math.floor(rnd() * CLIENTES.length)];
        add(d, true, (60 + rnd() * 70) * fator, `PIX RECEBIDO ${cli}`, { nome: cli, documento: '' });
      }
    }
    if (semana === 1) add(d, false, 520 + rnd() * 180, 'PIX ENVIADO DISTRIBUIDORA PET MAIS LTDA', { nome: 'DISTRIBUIDORA PET MAIS LTDA', documento: '22.333.444/0001-55' });
    // O dono tira dinheiro do caixa por Pix para a própria conta
    if (semana !== 0 && rnd() < 0.4) add(d, false, 120 + rnd() * 160, 'PIX ENVIADO JOAO PEREIRA DA SILVA', pixDono());
    // Gastos pessoais pagos com o cartão da empresa (o app sugere "pessoal" e pede confirmação)
    if (rnd() < 0.08) add(d, false, 25 + rnd() * 60, rnd() < 0.5 ? 'COMPRA CARTAO DROGARIA SAO PAULO' : 'COMPRA CARTAO IFOOD *RESTAURANTE', null);
    if (rnd() < 0.04) add(d, false, 40 + rnd() * 60, 'COMPRA CARTAO FERRAGENS SAO JORGE', null);
    if (rnd() < 0.05) add(d, false, 30 + rnd() * 50, 'COMPRA CARTAO PRODUTOS DE LIMPEZA ALVORADA', null);
    // Contas fixas no dia do vencimento
    for (const f of FIXAS) if (Number(d.slice(8, 10)) === f.dia) add(d, false, f.valor, f.descricao, f.parte || null);
  }

  // Situações do mês atual que o app deve detectar
  const dia1 = `${mesAtual}-01`;
  const quandoNoMes = (n) => (somarDias(dia1, n) <= hoje ? somarDias(dia1, n) : hoje);
  add(quandoNoMes(3), false, 480, 'PIX ENVIADO ASSISTENCIA TECNICA ELETROPET', { nome: 'ASSISTENCIA TECNICA ELETROPET', documento: '33.444.555/0001-66' });
  add(quandoNoMes(5), false, 1400, 'PIX ENVIADO JOAO PEREIRA DA SILVA', pixDono());
  add(somarDias(hoje, -2), false, 189.9, 'PIX ENVIADO AUTO CENTER BOA VIAGEM', { nome: 'AUTO CENTER BOA VIAGEM', documento: '44.555.666/0001-77' });
  return brutas.sort((a, b) => a.data.localeCompare(b.data));
}

export function gerarDemo(hoje) {
  const inicial = {
    config: { nomeNegocio: 'Pet Shop Amigo Fiel', saldoInicial: 0, demo: true },
    lancamentos: [],
    contas: [
      // Boletos de fornecedor já cadastrados (não recorrentes): um vence amanhã, outro daqui a 12 dias
      { id: 'demo-bol-1', descricao: 'Boleto petiscos e areia', valor: 420, categoria: 'Fornecedor', vencimento: somarDias(hoje, 1), recorrente: false, paga: false },
      { id: 'demo-bol-2', descricao: 'Boleto ração (distribuidora)', valor: 1650, categoria: 'Fornecedor', vencimento: somarDias(hoje, 12), recorrente: false, paga: false },
    ],
    regras: {},
  };
  const banco = { nome: 'Banco de demonstração', saldo: 0, titular: DONO_DEMO.nome, documento: DONO_DEMO.documento, demo: true, atualizadoEm: new Date().toISOString() };
  const { dados } = importarExtrato(inicial, gerarExtratoDemo(hoje), hoje, banco);

  // Ajusta o saldo do "banco" para que o caixa de hoje esteja positivo, mas a previsão
  // mostre que vai faltar dinheiro (cenário típico relatado na pesquisa).
  const menor = Math.min(...projecao(dados, hoje).pontos.map((p) => p.saldo));
  const ajuste = Math.round(-menor - 450);
  dados.config.saldoInicial += ajuste;
  dados.config.banco.saldo = Math.round((dados.config.banco.saldo + ajuste) * 100) / 100;
  return dados;
}
