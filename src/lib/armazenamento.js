// Os dados ficam no próprio aparelho (localStorage). Sem login e sem servidor no MVP.
const CHAVE = 'caixa-claro:v1';

export const DADOS_VAZIOS = {
  config: { nomeNegocio: 'Meu negócio', saldoInicial: 0, demo: false },
  lancamentos: [],
  contas: [],
};

export function carregar() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

export function salvar(dados) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados));
  } catch {
    // Sem armazenamento disponível (modo privado): o app continua funcionando só na memória.
  }
}

export function novoId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function exportarCSV(dados) {
  const linhas = [['data', 'tipo', 'categoria', 'descricao', 'valor']];
  for (const l of [...dados.lancamentos].sort((a, b) => a.data.localeCompare(b.data)))
    linhas.push([l.data, l.tipo, l.categoria, (l.descricao || '').replaceAll(';', ','), l.valor.toFixed(2).replace('.', ',')]);
  return linhas.map((l) => l.join(';')).join('\n');
}
