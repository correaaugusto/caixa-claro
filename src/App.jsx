import { useEffect, useMemo, useState } from 'react';
import Icone from './componentes/Icone.jsx';
import Inicio from './telas/Inicio.jsx';
import Lancar from './telas/Lancar.jsx';
import Contas from './telas/Contas.jsx';
import Previsao from './telas/Previsao.jsx';
import Ajustes from './telas/Ajustes.jsx';
import { carregar, salvar, novoId, DADOS_VAZIOS } from './lib/armazenamento.js';
import { gerarDemo } from './lib/demo.js';
import { hojeISO } from './lib/datas.js';
import { pagarConta } from './lib/financas.js';
import { avisoDoDiaSeNecessario } from './lib/aviso.js';

const ABAS = [
  { id: 'inicio', rotulo: 'Início', icone: 'inicio' },
  { id: 'lancar', rotulo: 'Lançar', icone: 'lancar' },
  { id: 'contas', rotulo: 'Contas', icone: 'contas' },
  { id: 'previsao', rotulo: 'Previsão', icone: 'previsao' },
];

export default function App() {
  const hoje = hojeISO();
  // Na primeira visita o app abre com a demonstração, para mostrar o valor logo de cara.
  const [dados, setDados] = useState(() => carregar() || gerarDemo(hoje));
  const [tela, setTela] = useState('inicio');
  const [tipoInicial, setTipoInicial] = useState('entrada');
  const [aviso, setAviso] = useState(null);

  useEffect(() => salvar(dados), [dados]);
  useEffect(() => {
    avisoDoDiaSeNecessario(dados, hoje);
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
        setDados((d) => ({ ...d, contas: d.contas.filter((c) => c.id !== id) }));
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

  const props = { dados, hoje, acoes };

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
          <span>Dados de demonstração (simulados): pet shop de 1 pessoa, ~R$ 8 mil/mês.</span>
          <button className="shrink-0 font-semibold text-marca underline" onClick={acoes.comecarDoZero}>
            Usar os meus
          </button>
        </div>
      )}

      <main className="flex-1 px-4 pb-28 pt-4">
        {tela === 'inicio' && <Inicio {...props} />}
        {tela === 'lancar' && <Lancar {...props} tipoInicial={tipoInicial} />}
        {tela === 'contas' && <Contas {...props} />}
        {tela === 'previsao' && <Previsao {...props} />}
        {tela === 'ajustes' && <Ajustes {...props} />}
      </main>

      {aviso && (
        <div className="fixed inset-x-0 bottom-24 z-30 flex justify-center px-4" role="status">
          <div className="flex items-center gap-2 rounded-full bg-tinta px-4 py-2 text-sm font-medium text-fundo shadow-lg">
            <Icone nome="ok" tamanho={18} /> {aviso}
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-lg grid-cols-4">
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
