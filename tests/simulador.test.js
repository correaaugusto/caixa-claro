import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarTransacaoSimulada, historicoSimulado } from '../src/lib/simulador.js';
import { importarExtrato, paraRevisar } from '../src/lib/banco.js';
import { saldoAtual } from '../src/lib/financas.js';

const HOJE = '2026-11-05';
// Situação parecida com o banco de teste da Pluggy já conectado
const conectado = () =>
  importarExtrato(
    { config: { saldoInicial: 0 }, lancamentos: [], contas: [{ id: 'luz', descricao: 'Boleto petiscos', valor: 420, categoria: 'Fornecedor', vencimento: '2026-11-06', paga: false }] },
    [],
    HOJE,
    { nome: 'Pluggy Bank', itemId: 'x', saldo: 1000, titular: 'MARIA DONA', documento: '111.222.333-44' },
  ).dados;
const simular = (dados, tipo) => importarExtrato(dados, [criarTransacaoSimulada(tipo, dados, HOJE)], HOJE).dados;

test('Pix recebido vira venda e soma no caixa, marcado como simulado', () => {
  const d = simular(conectado(), 'pix-recebido');
  const l = d.lancamentos.at(-1);
  assert.deepEqual([l.tipo, l.categoria, l.simulado], ['entrada', 'Vendas', true]);
  assert.equal(saldoAtual(d, HOJE), 1000 + l.valor);
});

test('Pix para o titular vira retirada sem precisar confirmar', () => {
  const l = simular(conectado(), 'retirada').lancamentos.at(-1);
  assert.deepEqual([l.tipo, l.revisar], ['retirada', false]);
});

test('Boleto simulado dá baixa sozinho na conta a pagar', () => {
  const d = simular(conectado(), 'boleto');
  assert.equal(d.contas.find((c) => c.id === 'luz').paga, true);
});

test('Gasto pessoal vai para o Confira', () => {
  assert.equal(paraRevisar(simular(conectado(), 'pessoal')).length, 1);
});

test('Sincronizar o banco real de novo não apaga o efeito das simulações no saldo', () => {
  let d = simular(conectado(), 'pix-recebido');
  const valor = d.lancamentos.at(-1).valor;
  d = importarExtrato(d, [], HOJE, { nome: 'Pluggy Bank', itemId: 'x', saldo: 1000, titular: 'MARIA DONA', documento: '111.222.333-44' }).dados;
  assert.equal(saldoAtual(d, HOJE), 1000 + valor);
});

test('Histórico de 3 meses descobre as contas fixas e não duplica', () => {
  let d = conectado();
  d = importarExtrato(d, historicoSimulado(d, HOJE), HOJE).dados;
  assert.ok(d.contas.filter((c) => c.auto).length >= 4);
  const pixTitular = d.lancamentos.filter((l) => l.descricao === 'Maria Dona');
  assert.ok(pixTitular.length > 0 && pixTitular.every((l) => l.tipo === 'retirada' && !l.revisar), 'Pix para o titular reconhecido como retirada');
  assert.equal(historicoSimulado(d, HOJE).length, 0);
});

test('Com o histórico, "boleto pago" encontra a próxima conta fixa e dá baixa mesmo pago antes', () => {
  let d = conectado();
  d = importarExtrato(d, historicoSimulado(d, HOJE), HOJE).dados;
  d = simular(simular(d, 'boleto'), 'boleto'); // paga o boleto avulso e depois a próxima conta fixa
  const pagasHoje = d.contas.filter((c) => c.paga && c.pagaEm === HOJE);
  assert.equal(pagasHoje.length, 2);
  assert.ok(pagasHoje.some((c) => c.auto));
});

test('Histórico simulado é passado: não muda o saldo de hoje, nem depois de sincronizar', () => {
  const banco = { nome: 'Pluggy Bank', itemId: 'x', saldo: 1000, titular: 'MARIA DONA', documento: '111.222.333-44' };
  let d = conectado();
  d = importarExtrato(d, historicoSimulado(d, HOJE), HOJE, d.config.banco).dados;
  assert.equal(Math.round(saldoAtual(d, HOJE) * 100) / 100, 1000);
  d = importarExtrato(d, [], HOJE, banco).dados;
  assert.equal(Math.round(saldoAtual(d, HOJE) * 100) / 100, 1000);
});
