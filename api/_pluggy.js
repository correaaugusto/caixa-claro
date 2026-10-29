// Ponte com a Pluggy (Open Finance). Roda no servidor (funções da Vercel):
// a chave secreta fica em variáveis de ambiente e nunca vai para o celular.
import { PluggyClient } from 'pluggy-sdk';

export const configurado = () => Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
export const sandbox = () => process.env.PLUGGY_SANDBOX === '1';

let cliente;
// Usado só nos testes, para simular as respostas da Pluggy sem chaves reais.
export function definirClienteParaTeste(c) {
  cliente = c;
}
export function pluggy() {
  cliente ||= new PluggyClient({ clientId: process.env.PLUGGY_CLIENT_ID, clientSecret: process.env.PLUGGY_CLIENT_SECRET });
  return cliente;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const itemIdValido = (id) => typeof id === 'string' && UUID.test(id);

export function erro(res, status, mensagem) {
  res.status(status).json({ erro: mensagem });
}
