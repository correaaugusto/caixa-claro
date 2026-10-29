// Modo apresentação: cria transações no MESMO formato do extrato do banco, para mostrar
// o processamento automático ao vivo (Pix recebido, Pix enviado, boleto pago...).
// Tudo sai marcado como "simulado" e não altera o saldo real vindo do banco.
import { somarDias } from './datas.js';
import { gerarExtratoDemo } from './demo.js';

const CLIENTES = ['MARIA S OLIVEIRA', 'CARLOS A SOUZA', 'ANA P LIMA', 'BRUNO COSTA', 'JULIANA R ALVES', 'PEDRO H ROCHA'];
const sorteio = (lista) => lista[Math.floor(Math.random() * lista.length)];
const valorEntre = (min, max) => Math.round((min + Math.random() * (max - min)) * 100) / 100;
const novoId = () => `sim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const SIMULACOES = [
  { id: 'pix-recebido', rotulo: 'Pix recebido de cliente', icone: 'mais' },
  { id: 'pix-fornecedor', rotulo: 'Pix enviado ao fornecedor', icone: 'menos' },
  { id: 'boleto', rotulo: 'Boleto pago (próxima conta)', icone: 'contas' },
  { id: 'retirada', rotulo: 'Pix para mim (retirada)', icone: 'pessoa' },
  { id: 'pessoal', rotulo: 'Gasto pessoal no cartão', icone: 'alerta' },
];

// Devolve uma transação "bruta" (formato de importarExtrato) ou null se não houver o que simular.
export function criarTransacaoSimulada(tipo, dados, hoje, personalizado = {}) {
  const base = { idExterno: novoId(), data: personalizado.data || hoje, simulado: true };
  const valor = personalizado.valor;
  const titular = dados.config.banco || {};
  switch (tipo) {
    case 'pix-recebido': {
      const nome = personalizado.nome || sorteio(CLIENTES);
      return { ...base, credito: true, valor: valor || valorEntre(60, 280), descricao: `PIX RECEBIDO ${nome}`, contraparte: { nome, documento: '' } };
    }
    case 'pix-fornecedor': {
      const nome = personalizado.nome || 'DISTRIBUIDORA PET MAIS LTDA';
      return { ...base, credito: false, valor: valor || valorEntre(300, 700), descricao: `PIX ENVIADO ${nome}`, contraparte: { nome, documento: '' } };
    }
    case 'boleto': {
      // A baixa automática reconhece pagamento antecipado: até 30 dias se o favorecido é conhecido, 10 se não.
      const conta = dados.contas
        .filter((c) => !c.paga && c.vencimento <= somarDias(hoje, c.chave ? 30 : 10))
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
      if (!conta) return null;
      // Mesmo valor e mesmo favorecido da conta: o app reconhece e dá baixa sozinho.
      return {
        ...base,
        credito: false,
        valor: conta.valor,
        descricao: `PAGAMENTO BOLETO ${conta.descricao}`,
        contraparte: conta.chave?.startsWith('doc:') ? { nome: conta.descricao, documento: conta.chave.slice(4) } : null,
      };
    }
    case 'retirada': {
      const cpf = dados.config.dono?.cpf;
      const nome = titular.titular || 'TITULAR DA CONTA';
      return { ...base, credito: false, valor: valor || valorEntre(150, 400), descricao: `PIX ENVIADO ${nome}`, contraparte: { nome, documento: cpf || titular.documento || '' } };
    }
    case 'pessoal':
      return { ...base, credito: false, valor: valor || valorEntre(25, 90), descricao: sorteio(['COMPRA CARTAO IFOOD *RESTAURANTE', 'COMPRA CARTAO DROGARIA SAO PAULO', 'COMPRA CARTAO NETFLIX.COM']), contraparte: null };
    default:
      return null;
  }
}

// 3 meses de movimento (vendas, fornecedor, contas fixas, retiradas) para os gráficos
// e para o app descobrir as contas fixas. Não repete o que já foi gerado.
export function historicoSimulado(dados, hoje) {
  if (dados.lancamentos.some((l) => l.idExterno?.startsWith('sim-hist-'))) return [];
  const titular = dados.config.banco || {};
  const dono = { nome: titular.titular || 'TITULAR DA CONTA', documento: dados.config.dono?.cpf || titular.documento || '' };
  return gerarExtratoDemo(somarDias(hoje, -1), dono).map((b) => ({ ...b, idExterno: `sim-hist-${b.idExterno}`, simulado: true, historico: true }));
}
