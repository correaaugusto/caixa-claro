import { useEffect, useMemo, useRef, useState } from 'react';
import Icone from './componentes/Icone.jsx';
import Inicio from './telas/Inicio.jsx';
import Lancar from './telas/Lancar.jsx';
import Contas from './telas/Contas.jsx';
import Previsao from './telas/Previsao.jsx';
import Ajustes from './telas/Ajustes.jsx';
import Confira from './telas/Confira.jsx';
import Simular from './telas/Simular.jsx';
import Extrato from './telas/Extrato.jsx';
import { carregar, salvar, novoId, DADOS_VAZIOS } from './lib/armazenamento.js';
import { gerarDemo } from './lib/demo.js';
import { hojeISO } from './lib/datas.js';
import { pagarConta } from './lib/financas.js';
import { importarExtrato, confirmarClassificacao } from './lib/banco.js';
import { sincronizarBanco } from './lib/conexao.js';
import { criarTransacaoSimulada, historicoSimulado } from './lib/simulador.js';
import { reais } from './lib/formato.js';
import { avisoDoDiaSeNecessario } from './lib/aviso.js';

const ABAS = [
  { id: 'inicio', rotulo: 'Início', icone: 'inicio' },
  { id: 'extrato', rotulo: 'Extrato', icone: 'extrato' },
  { id: 'lancar', rotulo: 'Lançar', icone: 'lancar' },
  { id: 'contas', rotulo: 'Contas', icone: 'contas' },
  { id: 'previsao', rotulo: 'Previsão', icone: 'previsao' },
];

// Antes da primeira simulação, guarda uma cópia dos dados para "Apagar movimentos simulados" voltar exatamente ao que era.
function guardarAntesDaSimulacao(atual, novo) {
  novo.semSimulacao = atual.semSimulacao || { ...atual, semSimulacao: undefined };
}

const TEXTO_TIPO = { entrada: 'Venda', aporte: 'Dinheiro do dono', saida: 'Gasto do negócio', retirada: 'Retirada pessoal' };
function explicarClassificacao(l) {
  if (l.revisar) return `Foi para o "Confira": ${l.motivo.toLowerCase()}`;
  return `Classificado sozinho como ${TEXTO_TIPO[l.tipo]}${l.tipo === 'saida' ? ` (${l.categoria})` : ''}: ${l.motivo.toLowerCase()}`;
}

// Simula o aviso que, em produção, chegaria a cada transação (fase 3: webhook + push).
function notificar(titulo, corpo) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(titulo, { body: corpo, icon: '/icone.svg' });
  } catch {
    // sem suporte a notificação: o resultado aparece na tela
  }
}

export default function App() {
  const hoje = hojeISO();
  // Na primeira visita o app abre com a demonstração, para mostrar o valor logo de cara.
  const [dados, setDados] = useState(() => carregar() || gerarDemo(hoje));
  const [tela, setTela] = useState('inicio');
  const [tipoInicial, setTipoInicial] = useState('entrada');
  const [aviso, setAviso] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);

  const dadosRef = useRef(dados);
  dadosRef.current = dados;
  useEffect(() => salvar(dados), [dados]);
  useEffect(() => {
    avisoDoDiaSeNecessario(dados, hoje);
    // Banco real conectado: busca o extrato sozinho ao abrir (se a última busca tiver mais de 1 h).
    const banco = dados.config.banco;
    if (banco?.itemId && !banco.demo && Date.now() - new Date(banco.atualizadoEm || 0).getTime() > 3600000) acoes.sincronizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2200);
    return () => clearTimeout(t);
  }, [aviso]);

  const acoes = useMemo(
    () => ({
      lancar(l) {
        setDados((d) => ({ ...d, lancamentos: [...d.lancamentos, { ...l, id: novoId() }] }));
        setAviso('Anotado!');
      },
      apagarLancamento(id) {
        setDados((d) => ({ ...d, lancamentos: d.lancamentos.filter((l) => l.id !== id) }));
      },
      novaConta(c) {
        setDados((d) => ({ ...d, contas: [...d.contas, { ...c, id: novoId(), paga: false }] }));
        setAviso('Conta cadastrada');
      },
      pagar(id) {
        setDados((d) => pagarConta(d, id, hojeISO(), novoId));
        setAviso('Conta paga e registrada no caixa');
      },
      apagarConta(id) {
        setDados((d) => {
          const conta = d.contas.find((c) => c.id === id);
          // conta descoberta automaticamente: não recriar a mesma série
          const seriesIgnoradas = conta?.serie ? [...(d.seriesIgnoradas || []), conta.serie] : d.seriesIgnoradas;
          return { ...d, seriesIgnoradas, contas: d.contas.filter((c) => c.id !== id) };
        });
      },
      async sincronizar({ itemId, atualizarAgora = false } = {}) {
        const alvo = itemId || dadosRef.current.config.banco?.itemId;
        if (!alvo) return;
        setSincronizando(true);
        try {
          const { transacoes, banco } = await sincronizarBanco(alvo, { atualizarAgora });
          const atual = dadosRef.current;
          // Saindo da demonstração para um banco real: começa limpo, mantendo nome e CPF do dono.
          const base = atual.config.demo
            ? { ...DADOS_VAZIOS, config: { ...DADOS_VAZIOS.config, nomeNegocio: atual.config.nomeNegocio, dono: atual.config.dono } }
            : atual;
          const r = importarExtrato(base, transacoes, hojeISO(), banco);
          setDados(r.dados);
          setAviso(r.novos ? `${r.novos} lançamento(s) novo(s) do banco` : 'Banco atualizado');
        } catch (e) {
          setAviso(e.message);
        } finally {
          setSincronizando(false);
        }
      },
      // ----- modo apresentação -----
      simular(tipo, personalizado) {
        const atual = dadosRef.current;
        const hojeAgora = hojeISO();
        const bruta = criarTransacaoSimulada(tipo, atual, hojeAgora, personalizado);
        if (!bruta)
          return { ok: false, titulo: 'Nenhuma conta a pagar nos próximos dias', linhas: ['Gere o histórico (o app descobre as contas fixas) ou cadastre um boleto em Contas.'] };
        const r = importarExtrato(atual, [bruta], hojeAgora);
        guardarAntesDaSimulacao(atual, r.dados);
        setDados(r.dados);
        const l = r.dados.lancamentos.find((x) => x.idExterno === bruta.idExterno);
        const pagas = r.dados.contas.filter((c) => c.paga && !atual.contas.find((x) => x.id === c.id)?.paga);
        const linhas = [explicarClassificacao(l), ...pagas.map((c) => `Conta "${c.descricao}" marcada como paga sozinha`)];
        const titulo = `${bruta.credito ? 'Entrou' : 'Saiu'} ${reais(l.valor)}: ${l.descricao}`;
        notificar(titulo, linhas[0]);
        return { ok: true, titulo, linhas };
      },
      gerarHistorico() {
        const atual = dadosRef.current;
        const brutas = historicoSimulado(atual, hojeISO());
        // Passado já está no saldo do banco: reimporta com o mesmo saldo para ele não mudar.
        const r = importarExtrato(atual, brutas, hojeISO(), atual.config.banco);
        guardarAntesDaSimulacao(atual, r.dados);
        setDados(r.dados);
        const fixas = r.dados.contas.filter((c) => c.auto && !c.paga).map((c) => c.descricao);
        return {
          ok: true,
          titulo: `${r.novos} movimentos de 3 meses importados`,
          linhas: [`Contas fixas descobertas sozinhas: ${fixas.join(', ') || 'nenhuma'}`, 'Veja os gráficos em Previsão e as contas em Contas'],
        };
      },
      limparSimuladas() {
        const antes = dadosRef.current.semSimulacao;
        setDados((d) => (antes ? { ...antes } : { ...d, lancamentos: d.lancamentos.filter((l) => !l.simulado) }));
        setAviso('Movimentos simulados apagados');
      },
      desconectarBanco() {
        setDados((d) => ({ ...d, config: { ...d.config, banco: undefined } }));
      },
      confirmar(lancamentoId, escolha) {
        setDados((d) => confirmarClassificacao(d, lancamentoId, escolha));
      },
      salvarConfig(config) {
        setDados((d) => ({ ...d, config: { ...d.config, ...config } }));
        setAviso('Salvo');
      },
      carregarDemo() {
        setDados(gerarDemo(hojeISO()));
        setTela('inicio');
      },
      comecarDoZero() {
        setDados({ ...DADOS_VAZIOS, config: { ...DADOS_VAZIOS.config } });
        setTela('ajustes');
      },
      irPara(t, tipo) {
        if (tipo) setTipoInicial(tipo);
        setTela(t);
        window.scrollTo(0, 0);
      },
    }),
    [],
  );

  const props = { dados, hoje, acoes, sincronizando };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-borda bg-fundo/95 px-4 py-3 backdrop-blur">
        <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => acoes.irPara('inicio')}>
          <img src="/icone.svg" alt="" className="h-8 w-8" />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-marca">Caixa Claro</div>
            <div className="truncate text-sm font-semibold leading-tight">{dados.config.nomeNegocio}</div>
          </div>
        </button>
        <button
          className={`rounded-full p-2 ${tela === 'ajustes' ? 'bg-marca-suave text-marca' : 'text-tinta-2'}`}
          onClick={() => acoes.irPara('ajustes')}
          aria-label="Ajustes"
        >
          <Icone nome="ajustes" />
        </button>
      </header>

      {dados.config.demo && tela !== 'ajustes' && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl bg-marca-suave px-3 py-2 text-xs text-tinta-2">
          <span>Banco de demonstração (dados simulados): pet shop de 1 pessoa, ~R$ 8 mil/mês.</span>
          <button className="shrink-0 font-semibold text-marca underline" onClick={acoes.comecarDoZero}>
            Conectar o meu
          </button>
        </div>
      )}

      <main className="flex-1 px-4 pb-28 pt-4">
        {tela === 'inicio' && <Inicio {...props} />}
        {tela === 'lancar' && <Lancar {...props} tipoInicial={tipoInicial} />}
        {tela === 'contas' && <Contas {...props} />}
        {tela === 'previsao' && <Previsao {...props} />}
        {tela === 'ajustes' && <Ajustes {...props} />}
        {tela === 'confira' && <Confira {...props} />}
        {tela === 'simular' && <Simular {...props} />}
        {tela === 'extrato' && <Extrato {...props} />}
      </main>

      {aviso && (
        <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4" role="status">
          <div className="flex items-center gap-2 rounded-full bg-tinta px-4 py-2 text-sm font-medium text-fundo shadow-lg">
            <Icone nome="ok" tamanho={18} /> {aviso}
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => acoes.irPara(a.id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${tela === a.id ? 'text-marca' : 'text-tinta-3'}`}
              aria-current={tela === a.id ? 'page' : undefined}
            >
              <Icone nome={a.icone} traco={tela === a.id ? 2.4 : 2} />
              {a.rotulo}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
