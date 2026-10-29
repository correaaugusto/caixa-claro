import { useEffect, useRef, useState } from 'react';
import Icone from '../componentes/Icone.jsx';
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA, CATEGORIA_RETIRADA } from '../lib/financas.js';
import { somarDias, quandoTexto } from '../lib/datas.js';
import { lerValor, reais } from '../lib/formato.js';

const TIPOS = [
  { id: 'entrada', rotulo: 'Entrou', cor: 'bg-entrada' },
  { id: 'saida', rotulo: 'Saiu', cor: 'bg-saida' },
  { id: 'retirada', rotulo: 'Pra mim', cor: 'bg-retirada' },
];

const COR_TIPO = { entrada: 'text-entrada', aporte: 'text-entrada', saida: 'text-saida', retirada: 'text-retirada' };

// Meta: anotar em menos de 10 segundos -> valor + 1 toque na categoria + salvar.
export default function Lancar({ dados, hoje, acoes, tipoInicial }) {
  const [tipo, setTipo] = useState(tipoInicial);
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState(null);
  const [data, setData] = useState(hoje);
  const [descricao, setDescricao] = useState('');
  const campoValor = useRef(null);

  useEffect(() => campoValor.current?.focus(), [tipo]);

  const categorias = tipo === 'entrada' ? CATEGORIAS_ENTRADA : tipo === 'saida' ? CATEGORIAS_SAIDA : [];
  const catFinal = tipo === 'retirada' ? CATEGORIA_RETIRADA : categoria || categorias[0];
  const v = lerValor(valor);

  function trocarTipo(t) {
    setTipo(t);
    setCategoria(null);
  }

  function salvar(e) {
    e?.preventDefault();
    if (v <= 0) return campoValor.current?.focus();
    acoes.lancar({ tipo, valor: v, categoria: catFinal, data, descricao: descricao.trim() || catFinal });
    setValor('');
    setDescricao('');
    campoValor.current?.focus();
  }

  const recentes = [...dados.lancamentos]
    .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id))
    .slice(0, 8);

  return (
    <div className="space-y-4">
      {dados.config.banco && (
        <p className="flex gap-2 rounded-xl bg-marca-suave p-3 text-sm text-tinta-2">
          <Icone nome="banco" tamanho={18} className="mt-0.5 shrink-0 text-marca" />
          <span>
            O que passa pelo <b>{dados.config.banco.nome}</b> entra sozinho. Anote aqui só o que for em <b>dinheiro vivo</b>.
          </span>
        </p>
      )}
      <form onSubmit={salvar} className="cartao space-y-4 p-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-fundo p-1" role="tablist">
          {TIPOS.map((t) => (
            <button
              type="button"
              key={t.id}
              role="tab"
              aria-selected={tipo === t.id}
              onClick={() => trocarTipo(t.id)}
              className={`rounded-lg py-2 text-sm font-semibold ${tipo === t.id ? `${t.cor} text-white` : 'text-tinta-2'}`}
            >
              {t.rotulo}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-tinta-3">Valor</span>
          <div className={`mt-1 flex items-baseline gap-2 border-b-2 border-borda pb-1 ${COR_TIPO[tipo]}`}>
            <span className="text-2xl font-semibold">R$</span>
            <input
              ref={campoValor}
              inputMode="decimal"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="num w-full bg-transparent text-4xl font-bold text-tinta outline-none placeholder:text-borda"
              aria-label="Valor"
            />
          </div>
        </label>

        {tipo === 'retirada' ? (
          <p className="rounded-xl bg-fundo p-3 text-sm text-tinta-2">
            Use quando tirar dinheiro do caixa para você (pró-labore, contas de casa). Assim o app mostra quanto
            o negócio realmente lucrou e quanto foi para o seu bolso.
          </p>
        ) : (
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-tinta-3">Categoria</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {categorias.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCategoria(c)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    catFinal === c ? 'border-marca bg-marca-suave text-marca' : 'border-borda text-tinta-2'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {[hoje, somarDias(hoje, -1)].map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => setData(d)}
              className={`rounded-full border px-3 py-1.5 text-sm ${data === d ? 'border-marca bg-marca-suave text-marca' : 'border-borda text-tinta-2'}`}
            >
              {d === hoje ? 'Hoje' : 'Ontem'}
            </button>
          ))}
          <input
            type="date"
            value={data}
            max={hoje}
            onChange={(e) => e.target.value && setData(e.target.value)}
            className="rounded-full border border-borda bg-transparent px-3 py-1 text-sm text-tinta-2"
            aria-label="Outra data"
          />
        </div>

        <input
          placeholder="Descrição (opcional)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="w-full rounded-xl border border-borda bg-transparent px-3 py-2.5 text-sm outline-none focus:border-marca"
        />

        <button
          type="submit"
          className={`w-full rounded-2xl py-4 text-lg font-bold text-white ${TIPOS.find((t) => t.id === tipo).cor} disabled:opacity-40`}
          disabled={v <= 0}
        >
          Anotar {v > 0 ? reais(v) : ''}
        </button>
      </form>

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-3">Últimos lançamentos</h2>
        {recentes.length === 0 ? (
          <p className="text-sm text-tinta-2">Nada anotado ainda.</p>
        ) : (
          <ul className="cartao divide-y divide-borda">
            {recentes.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{l.descricao || l.categoria}</div>
                  <div className="flex items-center gap-1 text-xs text-tinta-3">
                    {l.origem === 'banco' && <Icone nome="banco" tamanho={12} />}
                    {quandoTexto(l.data, hoje)} · {l.categoria}
                    {l.simulado && <span className="ml-1 rounded bg-atencao-fundo px-1 font-semibold text-atencao-texto">simulado</span>}
                  </div>
                </div>
                <span className={`num text-sm font-semibold ${COR_TIPO[l.tipo]}`}>
                  {l.tipo === 'entrada' || l.tipo === 'aporte' ? '+' : '−'} {reais(l.valor)}
                </span>
                <button
                  onClick={() => acoes.apagarLancamento(l.id)}
                  className="p-1 text-tinta-3 hover:text-critico"
                  aria-label={`Apagar ${l.descricao}`}
                >
                  <Icone nome="lixo" tamanho={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
