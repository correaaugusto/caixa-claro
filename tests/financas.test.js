import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  saldoAtual, projecao, semaforo, alertas, pagarConta, contasEmAberto, totais,
} from '../src/lib/financas.js';
import { lerValor } from '../src/lib/formato.js';
import { gerarDemo } from '../src/lib/demo.js';
import { somarDias } from '../src/lib/datas.js';

const HOJE = '2026-11-05';
const base = (extra = {}) => ({
  config: { saldoInicial: 1000 },
  lancamentos: [],
  contas: [],
  ...extra,
});
let n = 0;
const id = () => `t${++n}`;

test('lerValor entende o formato brasileiro', () => {
  assert.equal(lerValor('1.200,50'), 1200.5);
  assert.equal(lerValor('1200,5'), 1200.5);
  assert.equal(lerValor('50'), 50);
  assert.equal(lerValor('R$ 3.000'), 3000);
  assert.equal(lerValor('12.5'), 12.5);
  assert.equal(lerValor(''), 0);
});

test('saldo considera entradas, saídas e retiradas até hoje', () => {
  const d = base({
    lancamentos: [
      { tipo: 'entrada', valor: 500, data: '2026-11-01' },
      { tipo: 'saida', valor: 200, data: '2026-11-02' },
      { tipo: 'retirada', valor: 100, data: '2026-11-03' },
      { tipo: 'entrada', valor: 999, data: '2026-11-10' }, // futuro: não conta
    ],
  });
  assert.equal(saldoAtual(d, HOJE), 1200);
});

test('contas recorrentes se repetem a cada mês na projeção', () => {
  const contas = [{ id: 'a', valor: 100, vencimento: '2026-11-10', recorrente: true, paga: false }];
  const lista = contasEmAberto(contas, '2027-01-31');
  assert.deepEqual(lista.map((c) => c.vencimento), ['2026-11-10', '2026-12-10', '2027-01-10']);
  assert.equal(lista[1].prevista, true);
});

test('semáforo fica vermelho quando uma conta deixa o saldo negativo', () => {
  const d = base({ contas: [{ id: 'a', descricao: 'Aluguel', valor: 1500, vencimento: '2026-11-15', paga: false }] });
  const s = semaforo(d, HOJE);
  assert.equal(s.cor, 'vermelho');
  assert.equal(s.primeiroNegativo.data, '2026-11-15');
  assert.equal(s.menor.saldo, -500);
});

test('semáforo amarelo quando o caixa não cobre as contas da semana mas a média de entradas cobre', () => {
  const lancamentos = [];
  for (let i = 0; i < 30; i++) lancamentos.push({ tipo: 'entrada', valor: 100, data: somarDias(HOJE, -i) });
  const d = base({
    config: { saldoInicial: -2800 },
    lancamentos,
    contas: [{ id: 'a', descricao: 'Fornecedor', valor: 400, vencimento: '2026-11-11', paga: false }],
  });
  assert.equal(saldoAtual(d, HOJE), 200);
  assert.equal(semaforo(d, HOJE).cor, 'amarelo');
});

test('semáforo verde quando sobra dinheiro', () => {
  assert.equal(semaforo(base(), HOJE).cor, 'verde');
});

test('pagar conta recorrente registra a saída e cria a do próximo mês', () => {
  const d = base({ contas: [{ id: 'a', descricao: 'Luz', valor: 200, categoria: 'Energia/água/internet', vencimento: '2026-11-15', recorrente: true, paga: false }] });
  const depois = pagarConta(d, 'a', HOJE, id);
  assert.equal(depois.contas.length, 2);
  assert.equal(depois.contas.find((c) => !c.paga).vencimento, '2026-12-15');
  assert.equal(saldoAtual(depois, HOJE), 800);
  // a saída da conta paga não entra na média de gastos do dia a dia (evita contar duas vezes)
  assert.equal(projecao(depois, HOJE).medias.gastoVariavel, 0);
});

test('alerta de retirada acima do lucro', () => {
  const d = base({
    lancamentos: [
      { tipo: 'entrada', valor: 1000, data: '2026-11-02' },
      { tipo: 'saida', valor: 700, data: '2026-11-03' },
      { tipo: 'retirada', valor: 500, data: '2026-11-04' },
    ],
  });
  const a = alertas(d, HOJE).find((x) => x.id === 'retirada');
  assert.ok(a, 'deveria alertar');
  assert.match(a.texto, /lucrou R\$\s?300/);
});

test('alerta de conta vencendo amanhã', () => {
  const d = base({ contas: [{ id: 'a', descricao: 'Boleto', valor: 50, vencimento: '2026-11-06', paga: false }] });
  assert.ok(alertas(d, HOJE).some((a) => a.id === 'amanha'));
});

test('demonstração gera o cenário de "vai faltar dinheiro" em qualquer data', () => {
  for (const dia of ['2026-01-01', '2026-02-28', '2026-11-05', '2026-12-31']) {
    const d = gerarDemo(dia);
    assert.ok(saldoAtual(d, dia) > 0, `saldo positivo em ${dia}`);
    assert.equal(semaforo(d, dia).cor, 'vermelho', dia);
    const t = totais(d.lancamentos, '0000-01-01', dia);
    assert.ok(t.entrou > 0 && t.retiradas > 0);
  }
});

test('semáforo amarelo quando o pior dia sobra menos que uma semana de gastos', () => {
  const lancamentos = [];
  for (let i = 0; i < 30; i++) lancamentos.push({ tipo: 'saida', valor: 10, data: somarDias(HOJE, -i) });
  // saldo hoje 1000, gastos 10/dia -> pior dia (30) = 1000 - 300 - 650 = 50 < 70 (uma semana)
  const d = base({
    config: { saldoInicial: 1300 },
    lancamentos,
    contas: [{ id: 'a', descricao: 'Fornecedor', valor: 650, vencimento: somarDias(HOJE, 20), paga: false }],
  });
  const s = semaforo(d, HOJE);
  assert.equal(s.cor, 'amarelo');
  assert.equal(s.menor.saldo, 50);
});
