// Conversa com as funções do servidor (/api) para conectar e sincronizar o banco.
// Sem servidor configurado (ex.: `npm run dev` ou deploy sem as chaves da Pluggy),
// o app oferece o banco de demonstração.

const ESPERA_ATUALIZACAO_MS = 4000;
const TENTATIVAS_ATUALIZACAO = 15; // ~1 minuto

export async function statusConexao() {
  try {
    const r = await fetch('/api/pluggy-status', { cache: 'no-store' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return { configurado: false };
    return await r.json();
  } catch {
    return { configurado: false };
  }
}

export async function pedirTokenConexao(itemId) {
  const r = await fetch('/api/pluggy-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemId ? { itemId } : {}),
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.erro || 'Não foi possível iniciar a conexão');
  return corpo.accessToken;
}

async function buscarExtrato(itemId) {
  const r = await fetch(`/api/pluggy-sync?itemId=${encodeURIComponent(itemId)}`, { cache: 'no-store' });
  // Sem servidor, a resposta é a própria página (HTML): isso é erro, não "extrato vazio".
  if (!(r.headers.get('content-type') || '').includes('json')) throw new Error('Servidor de conexão bancária indisponível');
  const corpo = await r.json();
  if (!r.ok || !corpo.banco) throw new Error(corpo.erro || 'Não foi possível buscar o extrato');
  return corpo;
}

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Busca o extrato. Com atualizarAgora, pede ao banco dados novos e espera terminar.
// Devolve { transacoes, banco } no formato que importarExtrato() espera.
export async function sincronizarBanco(itemId, { atualizarAgora = false } = {}) {
  if (atualizarAgora) {
    await fetch(`/api/pluggy-sync?itemId=${encodeURIComponent(itemId)}`, { method: 'POST' });
  }
  let corpo = await buscarExtrato(itemId);
  for (let i = 0; i < TENTATIVAS_ATUALIZACAO && ['UPDATING', 'MERGING'].includes(corpo.banco?.status); i++) {
    await espera(ESPERA_ATUALIZACAO_MS);
    corpo = await buscarExtrato(itemId);
  }
  if (corpo.banco?.status === 'LOGIN_ERROR' || corpo.banco?.status === 'WAITING_USER_ACTION')
    throw new Error('O banco pediu para autorizar de novo. Toque em "Reconectar".');

  const principal = corpo.contas?.[0] || {};
  return {
    transacoes: corpo.transacoes || [],
    banco: {
      nome: corpo.banco?.nome || 'Banco',
      itemId,
      saldo: (corpo.contas || []).reduce((t, c) => t + (c.saldo || 0), 0),
      titular: principal.titular,
      documento: principal.documento,
      atualizadoEm: corpo.banco?.atualizadoEm || new Date().toISOString(),
    },
  };
}
