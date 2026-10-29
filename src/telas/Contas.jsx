import { useState } from 'react';
import Icone from '../componentes/Icone.jsx';
import { CATEGORIAS_SAIDA, contasEmAberto } from '../lib/financas.js';
import { somarDias, quandoTexto, diaMes } from '../lib/datas.js';
import { lerValor, reais, reaisCurto } from '../lib/formato.js';

export default function Contas({ dados, hoje, acoes }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const abertas = dados.contas.filter((c) => !c.paga).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const semana = somarDias(hoje, 7);
  const grupos = [
    { titulo: 'Atrasadas', itens: abertas.filter((c) => c.vencimento < hoje), destaque: 'text-critico' },
    { titulo: 'Próximos 7 dias', itens: abertas.filter((c) => c.vencimento >= hoje && c.vencimento <= semana) },
    { titulo: 'Mais pra frente', itens: abertas.filter((c) => c.vencimento > semana) },
  ];
  const pagas = dados.contas
    .filter((c) => c.paga)
    .sort((a, b) => (b.pagaEm || '').localeCompare(a.pagaEm || ''))
    .slice(0, 5);

  // Visão de 3 meses: inclui as repetições das contas recorrentes (resolve o "só sei do próximo mês").
  const em90 = contasEmAberto(dados.contas, somarDias(hoje, 90));
  const total = (de, ate) => em90.filter((c) => c.vencimento >= de && c.vencimento <= ate).reduce((t, c) => t + c.valor, 0);
  const faixas = [
    { rotulo: 'Até 30 dias', valor: total('0000', somarDias(hoje, 30)) },
    { rotulo: '31 a 60', valor: total(somarDias(hoje, 31), somarDias(hoje, 60)) },
    { rotulo: '61 a 90', valor: total(somarDias(hoje, 61), somarDias(hoje, 90)) },
  ];

  return (
    <div className="space-y-4">
      <section className="cartao p-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-tinta-3">Quanto tenho para pagar</h2>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {faixas.map((f) => (
            <div key={f.rotulo} className="rounded-xl bg-fundo p-2">
              <div className="num text-base font-bold">{reaisCurto(f.valor)}</div>
              <div className="text-xs text-tinta-3">{f.rotulo}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-tinta-3">Inclui as contas que se repetem todo mês.</p>
      </section>

      {mostrarForm ? (
        <NovaConta
          hoje={hoje}
          onSalvar={(c) => {
            acoes.novaConta(c);
            setMostrarForm(false);
          }}
          onCancelar={() => setMostrarForm(false)}
        />
      ) : (
        <button
          onClick={() => setMostrarForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-marca py-3.5 font-bold text-white"
        >
          <Icone nome="mais" traco={3} /> Nova conta / boleto
        </button>
      )}

      {grupos.map(
        (g) =>
          g.itens.length > 0 && (
            <section key={g.titulo}>
              <h2 className={`mb-2 text-xs font-bold uppercase tracking-wide ${g.destaque || 'text-tinta-3'}`}>
                {g.titulo}
              </h2>
              <ul className="cartao divide-y divide-borda">
                {g.itens.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className="truncate">{c.descricao}</span>
                        {c.recorrente && <Icone nome="repetir" tamanho={14} className="shrink-0 text-tinta-3" />}
                      </div>
                      <div className={`text-xs ${c.vencimento < hoje ? 'font-semibold text-critico' : 'text-tinta-3'}`}>
                        vence {quandoTexto(c.vencimento, hoje)} · {c.categoria}
                        {c.recorrente && ' · todo mês'}
                        {c.auto && <span className="ml-1 rounded bg-marca-suave px-1.5 py-0.5 font-semibold text-marca">descoberta pelo banco</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="num font-semibold">{reais(c.valor)}</span>
                      <button
                        onClick={() => acoes.pagar(c.id)}
                        className="rounded-lg bg-bom-fundo px-3 py-1 text-sm font-semibold text-bom"
                      >
                        Pagar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}

      {abertas.length === 0 && <p className="text-center text-sm text-tinta-2">Nenhuma conta em aberto.</p>}

      {pagas.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-3">Pagas recentemente</h2>
          <ul className="cartao divide-y divide-borda opacity-80">
            {pagas.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Icone nome="ok" tamanho={18} className="text-bom" />
                <span className="min-w-0 flex-1 truncate">{c.descricao}</span>
                {c.pagaPeloBanco && <Icone nome="banco" tamanho={14} className="shrink-0 text-tinta-3" />}
                <span className="text-xs text-tinta-3">{diaMes(c.pagaEm || c.vencimento)}</span>
                <span className="num">{reais(c.valor)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function NovaConta({ hoje, onSalvar, onCancelar }) {
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState(somarDias(hoje, 1));
  const [categoria, setCategoria] = useState('Fornecedor');
  const [recorrente, setRecorrente] = useState(false);
  const v = lerValor(valor);
  const valido = descricao.trim() && v > 0 && vencimento;

  return (
    <form
      className="cartao space-y-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) onSalvar({ descricao: descricao.trim(), valor: v, vencimento, categoria, recorrente });
      }}
    >
      <input
        autoFocus
        placeholder="O que é? (ex.: Aluguel, boleto da ração)"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        className="w-full rounded-xl border border-borda bg-transparent px-3 py-2.5 outline-none focus:border-marca"
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-tinta-3">
          Valor (R$)
          <input
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="num mt-1 w-full rounded-xl border border-borda bg-transparent px-3 py-2.5 text-base text-tinta outline-none focus:border-marca"
          />
        </label>
        <label className="text-xs text-tinta-3">
          Vencimento
          <input
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
            className="mt-1 w-full rounded-xl border border-borda bg-transparent px-3 py-2.5 text-base text-tinta outline-none focus:border-marca"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {CATEGORIAS_SAIDA.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => setCategoria(c)}
            className={`rounded-full border px-3 py-1 text-sm ${categoria === c ? 'border-marca bg-marca-suave text-marca' : 'border-borda text-tinta-2'}`}
          >
            {c}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-3 rounded-xl bg-fundo p-3 text-sm">
        <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} className="h-5 w-5 accent-[var(--marca)]" />
        <span>
          <b>Repete todo mês</b> <span className="text-tinta-2">(aluguel, luz, internet...)</span>
        </span>
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} className="flex-1 rounded-xl border border-borda py-3 font-semibold text-tinta-2">
          Cancelar
        </button>
        <button type="submit" disabled={!valido} className="flex-1 rounded-xl bg-marca py-3 font-bold text-white disabled:opacity-40">
          Salvar
        </button>
      </div>
    </form>
  );
}
