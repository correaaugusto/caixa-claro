import { configurado, pluggy, itemIdValido, erro } from './_pluggy.js';

// Cria o token temporário que abre o widget Pluggy Connect no celular.
// Com itemId, o widget abre para reconectar/atualizar um banco já conectado.
export default async function handler(req, res) {
  if (req.method !== 'POST') return erro(res, 405, 'Use POST');
  if (!configurado()) return erro(res, 503, 'Conexão com bancos não configurada no servidor');
  const itemId = req.body?.itemId;
  if (itemId && !itemIdValido(itemId)) return erro(res, 400, 'itemId inválido');
  try {
    const { accessToken } = await pluggy().createConnectToken(itemId || undefined, { avoidDuplicates: true });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ accessToken });
  } catch (e) {
    console.error('pluggy-token', e?.message);
    erro(res, 502, 'Não foi possível falar com o serviço de conexão bancária');
  }
}
