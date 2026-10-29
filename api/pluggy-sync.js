import { configurado, pluggy, itemIdValido, erro } from './_pluggy.js';
import { normalizarTransacao } from '../src/lib/banco.js';

const DIAS_HISTORICO = 120;

// GET  ?itemId=...  -> contas + transações dos últimos 120 dias, já normalizadas para o app
// POST ?itemId=...  -> pede ao banco uma atualização agora (o app consulta de novo até terminar)
export default async function handler(req, res) {
  if (!configurado()) return erro(res, 503, 'Conexão com bancos não configurada no servidor');
  const itemId = req.query?.itemId;
  if (!itemIdValido(itemId)) return erro(res, 400, 'itemId inválido');
  res.setHeader('Cache-Control', 'no-store');
  const cliente = pluggy();

  try {
    if (req.method === 'POST') {
      const item = await cliente.updateItem(itemId);
      return res.status(200).json({ status: item.status });
    }
    if (req.method !== 'GET') return erro(res, 405, 'Use GET ou POST');

    const item = await cliente.fetchItem(itemId);
    const banco = { nome: item.connector?.name || 'Banco', status: item.status, atualizadoEm: item.lastUpdatedAt };
    if (item.status === 'UPDATING' || item.status === 'MERGING') return res.status(200).json({ banco, contas: [], transacoes: [] });

    const desde = new Date(Date.now() - DIAS_HISTORICO * 86400000).toISOString().slice(0, 10);
    const { results: contas } = await cliente.fetchAccounts(itemId, 'BANK');
    const transacoes = [];
    for (const conta of contas) {
      const lista = await cliente.fetchAllTransactions(conta.id, { dateFrom: desde });
      for (const t of lista) transacoes.push(normalizarTransacao(t, conta));
    }
    res.status(200).json({
      banco,
      contas: contas.map((c) => ({ id: c.id, nome: c.marketingName || c.name, saldo: c.balance, titular: c.owner, documento: c.taxNumber })),
      transacoes,
    });
  } catch (e) {
    console.error('pluggy-sync', e?.message);
    erro(res, 502, 'Não foi possível buscar o extrato agora');
  }
}
