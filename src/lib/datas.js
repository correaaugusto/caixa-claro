// Datas sempre como texto 'AAAA-MM-DD' no fuso local, para evitar erros de fuso horário.

export function hojeISO() {
  return paraISO(new Date());
}

export function paraISO(d) {
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${a}-${m}-${dia}`;
}

export function deISO(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function somarDias(iso, n) {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return paraISO(d);
}

// Mesmo dia no mês seguinte; se não existir (ex.: 31), usa o último dia do mês.
export function somarMeses(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  const ultimoDia = new Date(a, m - 1 + n + 1, 0).getDate();
  return paraISO(new Date(a, m - 1 + n, Math.min(d, ultimoDia)));
}

export function diferencaDias(deIso, ateIso) {
  return Math.round((deISO(ateIso) - deISO(deIso)) / 86400000);
}

export function mesDe(iso) {
  return iso.slice(0, 7);
}

export function mesAnterior(mes, n = 1) {
  return somarMeses(`${mes}-01`, -n).slice(0, 7);
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function nomeMes(mes) {
  const [a, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]}/${String(a).slice(2)}`;
}

export function diaMes(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function diaSemana(iso) {
  return DIAS_SEMANA[deISO(iso).getDay()];
}

export function quandoTexto(iso, hoje) {
  const dif = diferencaDias(hoje, iso);
  if (dif === 0) return 'hoje';
  if (dif === 1) return 'amanhã';
  if (dif === -1) return 'ontem';
  if (dif < 0) return `há ${-dif} dias`;
  if (dif < 7) return `${diaSemana(iso)}, ${diaMes(iso)}`;
  return diaMes(iso);
}
