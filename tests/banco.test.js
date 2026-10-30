import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarTransacao, classificar, importarExtrato, confirmarClassificacao, paraRevisar, nomeAmigavel, chaveDe,
} from '../src/lib/banco.js';
import { saldoAtual, projecao, pagarConta } from '../src/lib/financas.js';

const HOJE = '2026-11-05';
const vazio = () => ({ config: { saldoInicial: 0 }, lancamentos: [], contas: [] });
const DONO = { nome: 'JOAO PEREIRA DA SILVA', documento: '123.456.789-09' };

// Transação no formato do SDK oficial da Pluggy (pluggy-sdk 0.94)
const tx = (id, date, type, amount, description, extra = {}) => ({ id, accountId: 'acc1', date, type, amount, description, status: 'POSTED', ...extra });
const bruta = (id, data, credito, valor, descricao, contraparte = null) => ({ idExterno: id, data, credito, valor, descricao, contraparte });

test('normaliza a transação da Pluggy: valor positivo, fuso de Brasília e favorecido', () => {
  const t = normalizarTransacao(
    tx('t1', '2026-11-05T01:30:00.000Z', 'DEBIT', -1200, 'PIX ENVIADO IMOBILIARIA LAR', {
      paymentData: { receiver: { name: 'IMOBILIARIA LAR FELIZ', documentNumber: { value: '11.222.333/0001-44', type: 'CNPJ' } }, boletoMetadata: null },
    }),
  );
  assert.equal(t.valor, 1200);
  assert.equal(t.credito, false);
  assert.equal(t.data, '2026-11-04'); // 01:30 UTC = 22:30 do dia anterior em Brasília
  assert.equal(t.contraparte.nome, 'IMOBILIARIA LAR FELIZ');
  assert.equal(chaveDe(t), 'doc:11222333000144');
});

test('nome amigável remove prefixos do banco', () => {
  assert.equal(nomeAmigavel(bruta('x', HOJE, false, 1, 'PAGAMENTO BOLETO CEMIG DISTRIBUICAO 05/11')), 'Cemig Distribuicao');
  assert.equal(nomeAmigavel(bruta('x', HOJE, false, 1, 'COMPRA CARTAO DEBITO DROGARIA SAO PAULO')), 'Drogaria Sao Paulo');
});

test('classifica sem digitar: contas, impostos, fornecedor, retirada para o dono e vendas', () => {
  const c = (b) => classificar(b, { dono: DONO });
  assert.equal(c(bruta('1', HOJE, false, 260, 'PAGAMENTO BOLETO CEMIG')).categoria, 'Energia/água/internet');
  assert.equal(c(bruta('2', HOJE, false, 76, 'PAGAMENTO DAS SIMPLES NACIONAL')).categoria, 'Impostos');
  assert.equal(c(bruta('3', HOJE, false, 600, 'PIX ENVIADO DISTRIBUIDORA PET MAIS LTDA')).categoria, 'Fornecedor');
  const ret = c(bruta('4', HOJE, false, 300, 'PIX ENVIADO', { nome: 'Joao Pereira da Silva', documento: '12345678909' }));
  assert.deepEqual([ret.tipo, ret.confianca], ['retirada', 'alta']);
  const ap = c(bruta('5', HOJE, true, 500, 'PIX RECEBIDO', { nome: 'JOAO PEREIRA DA SILVA', documento: '' }));
  assert.equal(ap.tipo, 'aporte');
  assert.deepEqual([c(bruta('6', HOJE, true, 80, 'PIX RECEBIDO MARIA S')).tipo, c(bruta('6', HOJE, true, 80, 'PIX RECEBIDO MARIA S')).categoria], ['entrada', 'Vendas']);
  const farm = c(bruta('7', HOJE, false, 45, 'COMPRA CARTAO DROGARIA SAO PAULO'));
  assert.deepEqual([farm.tipo, farm.confianca], ['retirada', 'baixa']);
  assert.equal(c(bruta('8', HOJE, false, 99, 'PIX ENVIADO FULANO DE TAL')).confianca, 'baixa');
});

test('importar não duplica e o saldo do app bate com o do banco', () => {
  const brutas = [bruta('a', '2026-11-01', true, 1000, 'PIX RECEBIDO CLIENTE'), bruta('b', '2026-11-02', false, 300, 'PAGAMENTO DAS SIMPLES NACIONAL')];
  let { dados, novos } = importarExtrato(vazio(), brutas, HOJE, { nome: 'Banco X', saldo: 2500 });
  assert.equal(novos, 2);
  assert.equal(saldoAtual(dados, HOJE), 2500);
  ({ dados, novos } = importarExtrato(dados, brutas, HOJE, { nome: 'Banco X', saldo: 2500 }));
  assert.equal(novos, 0);
  assert.equal(dados.lancamentos.length, 2);
  // dinheiro vivo anotado à mão soma ao saldo do banco
  dados = { ...dados, lancamentos: [...dados.lancamentos, { id: 'm', tipo: 'entrada', valor: 50, data: HOJE, categoria: 'Vendas' }] };
  assert.equal(saldoAtual(dados, HOJE), 2550);
});

test('descobre conta fixa sozinha, prevê a próxima e não conta duas vezes na média', () => {
  const brutas = ['2026-08-10', '2026-09-10', '2026-10-09'].map((d, i) =>
    bruta(`alug${i}`, d, false, 1200, 'PIX ENVIADO IMOBILIARIA', { nome: 'IMOBILIARIA LAR', documento: '11222333000144' }),
  );
  brutas.push(bruta('forn1', '2026-10-06', false, 500, 'PIX ENVIADO DISTRIBUIDORA PET'));
  brutas.push(bruta('forn2', '2026-10-13', false, 520, 'PIX ENVIADO DISTRIBUIDORA PET'));
  brutas.push(bruta('forn3', '2026-09-14', false, 510, 'PIX ENVIADO DISTRIBUIDORA PET'));
  const { dados } = importarExtrato(vazio(), brutas, HOJE, { nome: 'B', saldo: 5000 });
  const aluguel = dados.contas.filter((c) => c.auto);
  assert.equal(aluguel.length, 1, 'só o aluguel é fixo (fornecedor é várias vezes por mês)');
  assert.equal(aluguel[0].vencimento, '2026-11-09');
  assert.equal(aluguel[0].valor, 1200);
  assert.equal(projecao(dados, HOJE).medias.gastoVariavel > 0, true);
  assert.ok(dados.lancamentos.filter((l) => l.chave === 'doc:11222333000144').every((l) => l.contaId));
});

test('dá baixa sozinha quando o pagamento aparece no extrato e cria a do próximo mês', () => {
  const base = vazio();
  base.contas = [{ id: 'luz', descricao: 'Luz', valor: 260, categoria: 'Energia/água/internet', vencimento: '2026-11-03', recorrente: true, paga: false }];
  const { dados } = importarExtrato(base, [bruta('p1', '2026-11-03', false, 260, 'PAGAMENTO BOLETO CEMIG')], HOJE, { nome: 'B', saldo: 1000 });
  const luz = dados.contas.find((c) => c.id === 'luz');
  assert.equal(luz.paga, true);
  assert.equal(luz.pagaPeloBanco, true);
  assert.ok(dados.contas.some((c) => !c.paga && c.vencimento === '2026-12-03'));
});

test('se o dono já tinha tocado em Pagar, o lançamento manual é trocado pelo do banco', () => {
  let d = vazio();
  d.contas = [{ id: 'bol', descricao: 'Boleto ração', valor: 1650, categoria: 'Fornecedor', vencimento: '2026-11-04', paga: false }];
  d = pagarConta(d, 'bol', '2026-11-04', (() => { let n = 0; return () => `id${++n}`; })());
  assert.equal(d.lancamentos.length, 1);
  const { dados } = importarExtrato(d, [bruta('bb', '2026-11-04', false, 1650, 'PAGAMENTO BOLETO RACOES BRASIL')], HOJE, { nome: 'B', saldo: 1000 });
  assert.equal(dados.lancamentos.length, 1, 'não pode contar o pagamento duas vezes');
  assert.equal(dados.lancamentos[0].origem, 'banco');
  assert.equal(dados.lancamentos[0].contaId, 'bol');
});

test('Confira: só o incerto e recente; a confirmação vira regra para o mesmo favorecido', () => {
  const brutas = [
    bruta('n1', '2026-11-01', false, 90, 'PIX ENVIADO AUTO CENTER BOA VIAGEM'),
    bruta('n2', '2026-11-03', false, 110, 'PIX ENVIADO AUTO CENTER BOA VIAGEM'),
    bruta('velho', '2026-08-01', false, 70, 'PIX ENVIADO LOJA QUALQUER'),
    bruta('ok', '2026-11-02', false, 76, 'PAGAMENTO DAS'),
  ];
  let { dados } = importarExtrato(vazio(), brutas, HOJE, { nome: 'B', saldo: 0 });
  assert.deepEqual(paraRevisar(dados).map((l) => l.idExterno).sort(), ['n1', 'n2']);
  dados = confirmarClassificacao(dados, 'b-n1', { tipo: 'retirada', categoria: 'Retirada pessoal' });
  assert.equal(paraRevisar(dados).length, 0);
  assert.ok(dados.lancamentos.filter((l) => l.idExterno?.startsWith('n')).every((l) => l.tipo === 'retirada'));
  // próximo extrato do mesmo favorecido já vem classificado
  ({ dados } = importarExtrato(dados, [bruta('n3', '2026-11-05', false, 95, 'PIX ENVIADO AUTO CENTER BOA VIAGEM')], HOJE, { nome: 'B', saldo: 0 }));
  const n3 = dados.lancamentos.find((l) => l.idExterno === 'n3');
  assert.deepEqual([n3.tipo, n3.revisar], ['retirada', false]);
});

test('transação pendente só entra quando for confirmada', () => {
  const { dados } = importarExtrato(vazio(), [{ ...bruta('p', HOJE, false, 10, 'X'), pendente: true }], HOJE, null);
  assert.equal(dados.lancamentos.length, 0);
});

test('explica em português por que o banco não enviou os dados', async () => {
  const { explicarFalhaItem } = await import('../src/lib/conexao.js');
  assert.match(explicarFalhaItem({ executionStatus: 'INVALID_CREDENTIALS', error: { code: 'INVALID_CREDENTIALS', message: 'bad' } }), /usuário e a senha de teste.*INVALID_CREDENTIALS: bad/);
  assert.match(explicarFalhaItem({ executionStatus: 'ERROR', error: { code: 'UNEXPECTED_ERROR', message: 'x' } }), /não terminou.*UNEXPECTED_ERROR: x/);
  assert.equal(explicarFalhaItem(undefined), null);
});

test('pagamento do mês passado não quita a conta fixa deste mês', () => {
  const hoje = '2026-10-29';
  const brutas = ['2026-07-29', '2026-08-29', '2026-09-29'].map((d, i) => bruta(`c${i}`, d, false, 260, 'PAGAMENTO BOLETO CEMIG'));
  let { dados } = importarExtrato(vazio(), brutas, hoje, null);
  const conta = dados.contas.find((c) => c.auto);
  assert.deepEqual([conta.vencimento, conta.paga], [hoje, false]);
  ({ dados } = importarExtrato(dados, [bruta('c3', '2026-10-28', false, 262, 'PAGAMENTO BOLETO CEMIG')], hoje, null));
  assert.equal(dados.contas.find((c) => c.id === conta.id).paga, true);
});

test('gasto repetido em meses não seguidos não vira conta fixa', () => {
  const brutas = ['2026-04-04', '2026-07-04', '2026-10-04'].map((d, i) => bruta(`q${i}`, d, false, 480, 'PIX ENVIADO ASSISTENCIA TECNICA'));
  assert.equal(importarExtrato(vazio(), brutas, HOJE, null).dados.contas.length, 0);
});
