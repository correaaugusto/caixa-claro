// Testa as funções do servidor com um cliente Pluggy falso, que devolve dados no formato
// dos tipos do SDK oficial (pluggy-sdk 0.94): Item, Account, Transaction.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { definirClienteParaTeste } from '../api/_pluggy.js';
import status from '../api/pluggy-status.js';
import token from '../api/pluggy-token.js';
import sync from '../api/pluggy-sync.js';

const ITEM = '0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

function resposta() {
  const r = { codigo: 0, corpo: null, headers: {} };
  r.status = (c) => ((r.codigo = c), r);
  r.json = (b) => ((r.corpo = b), r);
  r.setHeader = (k, v) => (r.headers[k] = v);
  return r;
}

const chamadas = [];
const falso = {
  async createConnectToken(itemId, opcoes) {
    chamadas.push(['token', itemId, opcoes]);
    return { accessToken: 'tok-123' };
  },
  async fetchItem(id) {
    return { id, status: 'UPDATED', lastUpdatedAt: new Date('2026-11-05T10:00:00Z'), connector: { name: 'Banco Inter' } };
  },
  async updateItem(id) {
    chamadas.push(['update', id]);
    return { id, status: 'UPDATING' };
  },
  async fetchAccounts(itemId, tipo) {
    chamadas.push(['accounts', itemId, tipo]);
    return { results: [{ id: 'acc1', itemId, type: 'BANK', subtype: 'CHECKING_ACCOUNT', name: 'Conta Corrente', marketingName: null, balance: 3210.5, owner: 'JOAO PEREIRA DA SILVA', taxNumber: '123.456.789-09' }], page: 1, total: 1, totalPages: 1 };
  },
  async fetchAllTransactions(accountId, opcoes) {
    chamadas.push(['tx', accountId, opcoes]);
    return [
      { id: 'tx1', accountId, date: new Date('2026-11-04T15:00:00Z'), description: 'PIX RECEBIDO MARIA S', type: 'CREDIT', amount: 120, status: 'POSTED', category: 'Transfer - PIX', paymentData: { payer: { name: 'MARIA S', documentNumber: { value: '987.654.321-00', type: 'CPF' } }, boletoMetadata: null } },
      { id: 'tx2', accountId, date: new Date('2026-11-04T18:00:00Z'), description: 'PAGAMENTO BOLETO CEMIG', type: 'DEBIT', amount: -260, status: 'POSTED', category: 'Electricity' },
    ];
  },
};

beforeEach(() => {
  process.env.PLUGGY_CLIENT_ID = 'id';
  process.env.PLUGGY_CLIENT_SECRET = 'segredo';
  delete process.env.PLUGGY_SANDBOX;
  definirClienteParaTeste(falso);
  chamadas.length = 0;
});

test('status informa se a conexão real está configurada', () => {
  let r = resposta();
  status({}, r);
  assert.deepEqual(r.corpo, { configurado: true, sandbox: false });
  delete process.env.PLUGGY_CLIENT_SECRET;
  r = resposta();
  status({}, r);
  assert.equal(r.corpo.configurado, false);
});

test('token só por POST e devolve o accessToken do widget', async () => {
  let r = resposta();
  await token({ method: 'GET' }, r);
  assert.equal(r.codigo, 405);
  r = resposta();
  await token({ method: 'POST', body: {} }, r);
  assert.deepEqual([r.codigo, r.corpo], [200, { accessToken: 'tok-123' }]);
  assert.equal(JSON.stringify(r.corpo).includes('segredo'), false);
});

test('sync rejeita itemId inválido', async () => {
  const r = resposta();
  await sync({ method: 'GET', query: { itemId: '../../etc' } }, r);
  assert.equal(r.codigo, 400);
});

test('sync devolve contas e transações normalizadas dos últimos 120 dias', async () => {
  const r = resposta();
  await sync({ method: 'GET', query: { itemId: ITEM } }, r);
  assert.equal(r.codigo, 200);
  assert.equal(r.corpo.banco.nome, 'Banco Inter');
  assert.deepEqual(r.corpo.contas[0], { id: 'acc1', nome: 'Conta Corrente', saldo: 3210.5, titular: 'JOAO PEREIRA DA SILVA', documento: '123.456.789-09' });
  assert.deepEqual(r.corpo.transacoes.map((t) => [t.idExterno, t.credito, t.valor, t.data]), [['tx1', true, 120, '2026-11-04'], ['tx2', false, 260, '2026-11-04']]);
  assert.equal(r.corpo.transacoes[0].contraparte.documento, '987.654.321-00');
  assert.deepEqual(chamadas.find((c) => c[0] === 'accounts'), ['accounts', ITEM, 'BANK']);
  assert.match(chamadas.find((c) => c[0] === 'tx')[2].dateFrom, /^\d{4}-\d{2}-\d{2}$/);
});

test('POST no sync pede atualização ao banco', async () => {
  const r = resposta();
  await sync({ method: 'POST', query: { itemId: ITEM } }, r);
  assert.deepEqual(r.corpo, { status: 'UPDATING' });
  assert.deepEqual(chamadas, [['update', ITEM]]);
});

test('erro da Pluggy vira mensagem amigável, sem vazar detalhes', async () => {
  definirClienteParaTeste({ ...falso, fetchItem: async () => { throw new Error('401 invalid credentials secret=abc'); } });
  const r = resposta();
  const erroOriginal = console.error;
  console.error = () => {};
  await sync({ method: 'GET', query: { itemId: ITEM } }, r);
  console.error = erroOriginal;
  assert.equal(r.codigo, 502);
  assert.equal(JSON.stringify(r.corpo).includes('secret'), false);
});
