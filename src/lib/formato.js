const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moedaInteira = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

// Sinal de menos tipográfico + "word joiner" para o valor negativo não quebrar de linha.
const semQuebra = (t) => t.replace(/^-\s?/, '\u2212\u2060');

export function reais(v) {
  return semQuebra(moeda.format(v || 0));
}

export function reaisCurto(v) {
  return semQuebra(moedaInteira.format(Math.round(v || 0)));
}

// Aceita "1.200,50", "1200,5", "1200.50", "50" e "R$ 50".
export function lerValor(texto) {
  if (typeof texto === 'number') return texto;
  let t = String(texto || '').replace(/[^\d,.-]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(t)) t = t.replace(/\./g, '');
  const v = parseFloat(t);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}
