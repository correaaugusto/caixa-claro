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

// Explica em português por que o banco não terminou de enviar os dados
// (campos do Item da Pluggy: executionStatus e error { code, message }).
const MOTIVOS = {
  INVALID_CREDENTIALS: 'Usuário ou senha não aceitos pelo banco. No banco de teste da Pluggy, use exatamente o usuário e a senha de teste mostrados na tela de login.',
  INVALID_CREDENTIALS_MFA: 'O código de verificação não foi aceito. Tente de novo.',
  USER_INPUT_TIMEOUT: 'O banco pediu uma informação extra (ex.: código) e o tempo acabou. Tente de novo e responda logo.',
  SITE_NOT_AVAILABLE: 'O banco está fora do ar agora. Tente de novo em alguns minutos.',
  CONNECTION_ERROR: 'Falha de comunicação com o banco. Tente de novo em alguns minutos.',
  USER_AUTHORIZATION_PENDING: 'A autorização no app do banco ainda não foi concluída.',
  USER_AUTHORIZATION_NOT_GRANTED: 'A autorização no app do banco foi recusada ou cancelada.',
  ACCOUNT_LOCKED: 'O banco informou que o acesso está bloqueado. Desbloqueie no app do banco.',
  ACCOUNT_NEEDS_ACTION: 'O banco pede uma ação no app dele (ex.: aceitar termos) antes de liberar os dados.',
  ACCOUNT_CREDENTIALS_RESET: 'O banco pede para trocar a senha antes de liberar os dados.',
  USER_NOT_SUPPORTED: 'Este tipo de conta não é suportado por este banco.',
  ALREADY_LOGGED_IN: 'Já existe uma sessão aberta neste banco. Saia do internet banking e tente de novo.',
  PARTIAL_SUCCESS: 'Só parte dos dados veio do banco. O app vai usar o que chegou.',
};

export function explicarFalhaItem(item) {
  if (!item) return null;
  const codigo = item.error?.code || item.executionStatus || item.status;
  const motivo = MOTIVOS[codigo] || MOTIVOS[item.executionStatus];
  const detalhe = [codigo, item.error?.message].filter(Boolean).join(': ');
  return motivo ? `${motivo} (${detalhe})` : `O banco não terminou de enviar os dados${detalhe ? ` (${detalhe})` : ''}.`;
}
