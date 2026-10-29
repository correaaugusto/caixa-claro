// Transforma o extrato do banco em lançamentos organizados, sem o dono digitar nada:
// 1) normaliza a transação recebida do Open Finance (formato Pluggy);
// 2) classifica: venda, gasto do negócio (com categoria), retirada pessoal ou aporte;
// 3) descobre sozinho as contas que se repetem todo mês e prevê a próxima;
// 4) dá baixa automática nas contas a pagar quando o pagamento aparece no extrato.
// Só o que o app não reconhece com segurança vai para "Confira" (1 toque para confirmar),
// e cada confirmação vira uma regra: na próxima vez o app já sabe.
import { somarDias, somarMeses, mesDe, diferencaDias } from './datas.js';

const DIAS_PARA_REVISAR = 30; // só pede confirmação do que é recente
const CATEGORIA_RETIRADA = 'Retirada pessoal';

// ---------- texto ----------

export function semAcento(t) {
  return String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

const PREFIXOS = [
  /^PIX\s+(ENVIADO|RECEBIDO|TRANSF\w*|ENV|REC|QR\s*CODE)?\b/,
  /^TRANSF(ERENCIA)?\b(\s+PIX)?(\s+(ENVIADA|RECEBIDA|ENTRE CONTAS))?/,
  /^PAG(AMENTO|TO)?\b(\s+DE)?(\s+(BOLETO|CONTA|TITULO|CONVENIO))?/,
  /^COMPRA\b(\s+(NO|COM))?(\s+CART(AO|\.))?(\s+(DEBITO|CREDITO|DEB|CRED))?/,
  /^DEB(ITO)?\b(\s+(AUTOMATICO|AUT\.?))?/,
  /^(TED|DOC)\b(\s+(ENVIADA|RECEBIDA|ENVIADO|RECEBIDO))?/,
  /^(BOLETO|VENDA)\b/,
];

// Nome "limpo" do favorecido/pagador: sem "PIX ENVIADO", datas, números e símbolos.
export function nomeBase(b) {
  if (b.contraparte?.nome) return limpar(b.contraparte.nome);
  let t = limpar(b.descricao);
  for (let i = 0; i < 3; i++) for (const p of PREFIXOS) t = t.replace(p, '').trim();
  return t || limpar(b.descricao);
}

function limpar(t) {
  return semAcento(t)
    .replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, ' ')
    .replace(/[*#/\\.,:;|_-]+/g, ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nomeAmigavel(b) {
  const base = nomeBase(b);
  return base
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && ['de', 'da', 'do', 'das', 'dos', 'e'].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

// Identifica "o mesmo favorecido" entre meses: pelo CPF/CNPJ quando o banco informa,
// senão pelas 3 primeiras palavras do nome limpo.
export function chaveDe(b) {
  const doc = soDigitos(b.contraparte?.documento);
  if (doc) return `doc:${doc}`;
  return `txt:${nomeBase(b).split(' ').slice(0, 3).join(' ')}`;
}

const soDigitos = (t) => String(t || '').replace(/\D/g, '');

// ---------- 1) normalização (formato Pluggy -> formato do app) ----------

// Data local de Brasília: o banco manda horário UTC, e uma compra às 22h não pode cair no dia seguinte.
function dataLocal(d) {
  const data = new Date(d);
  if (Number.isNaN(data.getTime())) return String(d).slice(0, 10);
  return data.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function normalizarTransacao(t, conta = {}) {
  const credito = t.type === 'CREDIT';
  const parte = credito ? t.paymentData?.payer : t.paymentData?.receiver;
  const contraparte = parte?.name || parte?.documentNumber?.value
    ? { nome: parte.name || '', documento: parte.documentNumber?.value || '' }
    : t.merchant
      ? { nome: t.merchant.name || t.merchant.businessName || '', documento: t.merchant.cnpj || '' }
      : null;
  return {
    idExterno: t.id,
    contaBancoId: t.accountId || conta.id,
    data: dataLocal(t.date),
    valor: Math.round(Math.abs(Number(t.amount)) * 100) / 100,
    credito,
    descricao: t.description || t.descriptionRaw || '',
    contraparte,
    categoriaBanco: t.category || null,
    pendente: t.status === 'PENDING',
  };
}

// ---------- 2) classificação ----------

const contem = (texto, termos) => termos.some((p) => ` ${texto} `.includes(` ${p} `) || (p.length > 5 && texto.includes(p)));

const REGRAS_PALAVRAS = [
  {
    categoria: 'Energia/água/internet',
    termos: ['CEMIG', 'ENEL', 'CPFL', 'LIGHT', 'COPEL', 'CELESC', 'EQUATORIAL', 'ENERGISA', 'NEOENERGIA', 'COELBA', 'CELPE', 'COSERN', 'ELEKTRO', 'CEEE', 'ENERGIA', 'ELETRICIDADE',
      'SABESP', 'COPASA', 'SANEPAR', 'CASAN', 'CEDAE', 'EMBASA', 'CORSAN', 'SANEAGO', 'COMPESA', 'CAGECE', 'SANEAMENTO', 'AGUA E ESGOTO',
      'VIVO', 'CLARO', 'TIM', 'OI', 'NET', 'INTERNET', 'TELEFONICA', 'FIBRA'],
  },
  { categoria: 'Impostos', termos: ['DAS', 'SIMPLES NACIONAL', 'DARF', 'RECEITA FEDERAL', 'GPS', 'INSS', 'IPTU', 'DAE', 'SEFAZ', 'ICMS', 'ISS', 'PREFEITURA', 'TRIBUTO', 'IMPOSTO', 'MEI'] },
  { categoria: 'Aluguel', termos: ['ALUGUEL', 'IMOBILIARIA', 'CONDOMINIO', 'LOCACAO'] },
  { categoria: 'Salários', termos: ['SALARIO', 'FOLHA', 'FGTS', 'VALE TRANSPORTE'] },
  { categoria: 'Fornecedor', termos: ['DISTRIBUIDORA', 'DISTRIBUIDOR', 'ATACADAO', 'ATACADO', 'ATACADISTA', 'ASSAI', 'MAKRO', 'ATACAREJO', 'INSUMOS', 'FORNECEDOR', 'INDUSTRIA', 'RACOES'] },
  { categoria: 'Manutenção', termos: ['MANUTENCAO', 'CONSERTO', 'ASSISTENCIA TECNICA', 'FERRAGENS', 'FERRAGISTA', 'MATERIAL DE CONSTRUCAO', 'ELETRICISTA', 'ENCANADOR', 'REPARO'] },
  { categoria: 'Outros', termos: ['LIMPEZA', 'PAPELARIA', 'MATERIAL DE ESCRITORIO', 'TARIFA', 'CESTA DE SERVICOS', 'MENSALIDADE PACOTE'] },
];

const TERMOS_PESSOAIS = ['FARMACIA', 'DROGARIA', 'DROGASIL', 'RAIA', 'PAGUE MENOS', 'IFOOD', 'RAPPI', 'UBER', '99APP', 'NETFLIX', 'SPOTIFY', 'AMAZON PRIME', 'DISNEY', 'GLOBOPLAY',
  'HBO', 'CINEMA', 'ACADEMIA', 'SMART FIT', 'SHOPPING', 'RESTAURANTE', 'LANCHONETE', 'SUPERMERCADO', 'MERCADO', 'PADARIA', 'PIZZARIA', 'HAMBURGUERIA'];

// Categorias que a Pluggy já sugere (em inglês). Usadas só como pista extra, depois das palavras-chave.
const PISTAS_BANCO = [
  { termos: ['electricity', 'water', 'telecommunication', 'internet', 'phone'], tipo: 'saida', categoria: 'Energia/água/internet' },
  { termos: ['tax'], tipo: 'saida', categoria: 'Impostos' },
  { termos: ['rent'], tipo: 'saida', categoria: 'Aluguel' },
  { termos: ['salary', 'payroll'], tipo: 'saida', categoria: 'Salários' },
  { termos: ['pharmacy', 'drugstore', 'food delivery', 'restaurant', 'streaming', 'entertainment', 'leisure', 'groceries', 'supermarket', 'gym', 'fitness', 'taxi', 'ride'], tipo: 'retirada', categoria: CATEGORIA_RETIRADA, confianca: 'baixa' },
];

function ehDono(b, dono = {}) {
  const doc = soDigitos(b.contraparte?.documento);
  const docsDono = [dono.documento, dono.cpf].map(soDigitos).filter(Boolean);
  if (doc && docsDono.includes(doc)) return true;
  const nome = semAcento(b.contraparte?.nome || '').trim();
  const nomesDono = [dono.nome, dono.nomePessoa].map((n) => semAcento(n || '').trim()).filter((n) => n.length > 5);
  return Boolean(nome) && nomesDono.some((n) => n === nome);
}

// Devolve { tipo, categoria, confianca: 'alta' | 'baixa', motivo }
export function classificar(b, { regras = {}, dono = {} } = {}) {
  const regra = regras[chaveDe(b)];
  if (regra) return { ...regra, confianca: 'alta', motivo: 'Você já confirmou este favorecido antes' };

  const texto = `${semAcento(b.descricao)} ${semAcento(b.contraparte?.nome)}`.replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ');

  if (b.credito) {
    if (ehDono(b, dono)) return { tipo: 'aporte', categoria: 'Dinheiro do dono', confianca: 'alta', motivo: 'Dinheiro seu colocado no caixa' };
    if (contem(texto, ['ESTORNO', 'DEVOLUCAO', 'REEMBOLSO'])) return { tipo: 'entrada', categoria: 'Outros', confianca: 'baixa', motivo: 'Estorno ou devolução' };
    if (contem(texto, ['RENDIMENTO', 'JUROS', 'REMUNERACAO', 'RESGATE'])) return { tipo: 'entrada', categoria: 'Outros', confianca: 'alta', motivo: 'Rendimento' };
    return { tipo: 'entrada', categoria: 'Vendas', confianca: 'alta', motivo: 'Recebimento de cliente' };
  }

  if (ehDono(b, dono)) return { tipo: 'retirada', categoria: CATEGORIA_RETIRADA, confianca: 'alta', motivo: 'Transferência para você' };
  if (contem(texto, ['FATURA'])) return { tipo: 'saida', categoria: 'Outros', confianca: 'baixa', motivo: 'Fatura de cartão: é do negócio?' };
  for (const r of REGRAS_PALAVRAS) if (contem(texto, r.termos)) return { tipo: 'saida', categoria: r.categoria, confianca: 'alta', motivo: 'Reconhecido pelo nome' };
  if (contem(texto, TERMOS_PESSOAIS)) return { tipo: 'retirada', categoria: CATEGORIA_RETIRADA, confianca: 'baixa', motivo: 'Parece gasto pessoal' };

  const cat = String(b.categoriaBanco || '').toLowerCase();
  for (const p of PISTAS_BANCO)
    if (cat && p.termos.some((t) => cat.includes(t)))
      return { tipo: p.tipo, categoria: p.categoria, confianca: p.confianca || 'alta', motivo: 'Categoria informada pelo banco' };

  return { tipo: 'saida', categoria: 'Outros', confianca: 'baixa', motivo: 'Não reconhecemos este gasto' };
}

// ---------- importação ----------

// Junta o extrato ao que o app já tem: ignora o que já foi importado (mesmo id do banco),
// classifica o que é novo, descobre contas fixas e dá baixa nas contas pagas.
// banco: { nome, saldo, titular, documento, itemId } -> saldo do app passa a bater com o banco.
export function importarExtrato(dados, brutas, hoje, banco = null) {
  const jaTem = new Set(dados.lancamentos.map((l) => l.idExterno).filter(Boolean));
  // Titular da conta conectada (guardado na conexão) + CPF informado pelo dono em Ajustes.
  const titular = banco || dados.config.banco || {};
  const dono = { nome: titular.titular, documento: titular.documento, ...(dados.config.dono || {}) };
  const regras = dados.regras || {};
  const novos = [];
  for (const b of brutas) {
    if (!b.idExterno || jaTem.has(b.idExterno) || b.pendente) continue;
    jaTem.add(b.idExterno);
    const c = classificar(b, { regras, dono });
    novos.push({
      id: `b-${b.idExterno}`,
      idExterno: b.idExterno,
      origem: 'banco',
      data: b.data,
      valor: b.valor,
      tipo: c.tipo,
      categoria: c.categoria,
      descricao: nomeAmigavel(b),
      chave: chaveDe(b),
      motivo: c.motivo,
      revisar: c.confianca === 'baixa' && diferencaDias(b.data, hoje) <= DIAS_PARA_REVISAR,
      ...(b.simulado ? { simulado: true } : {}),
      ...(b.historico ? { historico: true } : {}),
    });
  }

  let resultado = {
    ...dados,
    regras,
    lancamentos: [...dados.lancamentos, ...novos].sort((a, b) => a.data.localeCompare(b.data)),
  };

  if (banco) {
    const somaBanco = resultado.lancamentos
      // Movimentos simulados "ao vivo" (modo apresentação) não existem no banco: ficam fora da conta do saldo real.
      // O histórico simulado representa o passado, que já está dentro do saldo do banco: entra na conta.
      .filter((l) => l.origem === 'banco' && (!l.simulado || l.historico) && l.data <= hoje)
      .reduce((t, l) => t + (l.tipo === 'entrada' || l.tipo === 'aporte' ? l.valor : -l.valor), 0);
    resultado.config = {
      ...resultado.config,
      // saldo do app = saldo do banco + o que foi anotado à mão (dinheiro vivo)
      saldoInicial: Math.round((banco.saldo - somaBanco) * 100) / 100,
      banco: {
        ...(resultado.config.banco || {}),
        nome: banco.nome,
        itemId: banco.itemId ?? resultado.config.banco?.itemId,
        demo: banco.demo || false,
        saldo: banco.saldo,
        titular: banco.titular ?? resultado.config.banco?.titular,
        documento: banco.documento ?? resultado.config.banco?.documento,
        atualizadoEm: banco.atualizadoEm || new Date().toISOString(),
      },
    };
  }

  resultado = detectarContasRecorrentes(resultado, hoje);
  resultado = conciliarContas(resultado, hoje);
  return { dados: resultado, novos: novos.length };
}

// ---------- 3) contas fixas descobertas sozinhas ----------

// Um mesmo favorecido pago 1 vez por mês, em pelo menos 2 meses, com valor parecido (±20%)
// e dia parecido (±6 dias) é tratado como conta fixa: o app cria a próxima com vencimento previsto.
export function detectarContasRecorrentes(dados, hoje) {
  const ignoradas = new Set(dados.seriesIgnoradas || []);
  const grupos = {};
  for (const l of dados.lancamentos) {
    if (l.origem !== 'banco' || l.tipo !== 'saida' || !l.chave) continue;
    (grupos[l.chave] ||= []).push(l);
  }

  const marcar = new Map(); // id do lançamento -> série
  const contas = [...dados.contas];
  for (const [chave, itens] of Object.entries(grupos)) {
    const serie = `auto:${chave}`;
    if (ignoradas.has(serie)) continue;
    const meses = new Set(itens.map((l) => mesDe(l.data)));
    if (meses.size < 2 || itens.length > meses.size) continue; // precisa ser 1 vez por mês
    const valores = itens.map((l) => l.valor).sort((a, b) => a - b);
    const mediana = valores[Math.floor(valores.length / 2)];
    if (valores.some((v) => Math.abs(v - mediana) > mediana * 0.2)) continue;
    const dias = itens.map((l) => Number(l.data.slice(8, 10)));
    if (Math.max(...dias) - Math.min(...dias) > 12) continue;

    itens.forEach((l) => marcar.set(l.id, serie));
    if (contas.some((c) => c.serie === serie && !c.paga)) continue;

    const ultimo = itens.reduce((m, l) => (l.data > m.data ? l : m));
    contas.push({
      id: `${serie}:${somarMeses(ultimo.data, 1)}`,
      serie,
      chave,
      descricao: ultimo.descricao,
      valor: ultimo.valor,
      categoria: ultimo.categoria,
      vencimento: somarMeses(ultimo.data, 1),
      recorrente: true,
      paga: false,
      auto: true,
    });
  }

  // Pagamentos de conta fixa não entram na média de gastos do dia a dia (já são previstos pela conta).
  const lancamentos = dados.lancamentos.map((l) => (marcar.has(l.id) && !l.contaId ? { ...l, contaId: marcar.get(l.id) } : l));
  return { ...dados, contas, lancamentos };
}

// ---------- 4) baixa automática ----------

// Uma conta em aberto é dada como paga quando aparece no extrato uma saída do mesmo
// favorecido (até 30 dias antes ou 10 depois do vencimento) ou com o valor exato (±10 dias).
// Se o dono já tinha tocado em "Pagar" à mão, o lançamento manual é trocado pelo do banco
// (assim o pagamento não conta duas vezes).
export function conciliarContas(dados) {
  let lancamentos = [...dados.lancamentos];
  let contas = [...dados.contas];
  const usados = new Set(lancamentos.filter((l) => l.origem === 'banco' && l.contaId && !String(l.contaId).startsWith('auto:')).map((l) => l.id));

  // Mesmo favorecido: aceita pagamento antecipado em até 30 dias. Só pelo valor exato: até 10 dias.
  const casa = (l, conta, ref) => {
    if (l.origem !== 'banco' || l.tipo !== 'saida' || usados.has(l.id)) return false;
    const dias = diferencaDias(ref, l.data); // negativo = pago antes da data de referência
    const mesmoFavorecido = conta.chave && l.chave === conta.chave && Math.abs(l.valor - conta.valor) <= conta.valor * 0.2;
    if (mesmoFavorecido) return dias >= -30 && dias <= 10;
    return Math.abs(l.valor - conta.valor) < 0.01 && Math.abs(dias) <= 10;
  };

  for (let i = 0; i < contas.length; i++) {
    const conta = contas[i];
    if (!conta.paga) {
      const l = lancamentos.find((x) => casa(x, conta, conta.vencimento));
      if (!l) continue;
      usados.add(l.id);
      lancamentos = lancamentos.map((x) => (x.id === l.id ? { ...x, contaId: conta.id } : x));
      contas[i] = { ...conta, paga: true, pagaEm: l.data, pagaPeloBanco: true };
      if (conta.recorrente && !contas.some((c) => c !== conta && c.serie && c.serie === conta.serie && !c.paga)) {
        const venc = somarMeses(conta.vencimento, 1);
        contas.push({ ...conta, id: `${conta.serie || conta.id}:${venc}`, vencimento: venc, paga: false, pagaEm: undefined, pagaPeloBanco: undefined });
      }
    } else if (!conta.pagaPeloBanco && conta.pagaEm) {
      const manual = lancamentos.find((x) => x.contaId === conta.id && x.origem !== 'banco');
      if (!manual) continue;
      const l = lancamentos.find((x) => casa(x, conta, conta.pagaEm));
      if (!l) continue;
      usados.add(l.id);
      lancamentos = lancamentos.filter((x) => x.id !== manual.id).map((x) => (x.id === l.id ? { ...x, contaId: conta.id } : x));
      contas[i] = { ...conta, pagaEm: l.data, pagaPeloBanco: true };
    }
  }
  return { ...dados, contas, lancamentos };
}

// ---------- confirmação do dono ("Confira") ----------

// Aplica a escolha a todos os lançamentos do mesmo favorecido e guarda como regra.
export function confirmarClassificacao(dados, lancamentoId, escolha) {
  const alvo = dados.lancamentos.find((l) => l.id === lancamentoId);
  if (!alvo) return dados;
  const regras = alvo.chave ? { ...(dados.regras || {}), [alvo.chave]: { tipo: escolha.tipo, categoria: escolha.categoria } } : dados.regras;
  const lancamentos = dados.lancamentos.map((l) =>
    l.id === lancamentoId || (alvo.chave && l.origem === 'banco' && l.chave === alvo.chave)
      ? { ...l, tipo: escolha.tipo, categoria: escolha.categoria, revisar: false, motivo: 'Confirmado por você' }
      : l,
  );
  return detectarContasRecorrentes({ ...dados, regras, lancamentos }, null);
}

export function paraRevisar(dados) {
  return dados.lancamentos.filter((l) => l.revisar).sort((a, b) => b.data.localeCompare(a.data));
}
