// Aviso diário via notificação do navegador. No MVP ele dispara quando o app é aberto
// (uma vez por dia). Envio por WhatsApp em horário fixo fica como evolução futura.
import { textoAvisoDiario } from './financas.js';

const CHAVE_ULTIMO = 'caixa-claro:ultimo-aviso';

export function notificacoesSuportadas() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function permissaoAtual() {
  return notificacoesSuportadas() ? Notification.permission : 'unsupported';
}

export async function pedirPermissao() {
  if (!notificacoesSuportadas()) return 'unsupported';
  return Notification.requestPermission();
}

export async function enviarAviso(dados, hoje) {
  if (permissaoAtual() !== 'granted') return false;
  const [titulo, ...resto] = textoAvisoDiario(dados, hoje);
  const opcoes = { body: resto.join('\n'), icon: '/icone.svg', badge: '/icone.svg', tag: 'aviso-diario' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(titulo, opcoes);
    else new Notification(titulo, opcoes);
    return true;
  } catch {
    return false;
  }
}

export async function avisoDoDiaSeNecessario(dados, hoje) {
  try {
    if (localStorage.getItem(CHAVE_ULTIMO) === hoje) return;
    if (await enviarAviso(dados, hoje)) localStorage.setItem(CHAVE_ULTIMO, hoje);
  } catch {
    // sem armazenamento: não envia para não repetir a cada abertura
  }
}
