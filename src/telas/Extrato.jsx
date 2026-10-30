import { useState } from 'react';
import Icone from '../componentes/Icone.jsx';
import { CATEGORIAS_SAIDA, CATEGORIA_RETIRADA, totais } from '../lib/financas.js';
import { quandoTexto, somarDias, mesDe, nomeMes } from '../lib/datas.js';
import { reais, reaisCurto } from '../lib/formato.js';

const FILTROS = [
  { id: 'tudo', rotulo: 'Tudo', aceita: () => true },
  { id: 'entrou', rotulo: 'Entrou', aceita: (l) => l.tipo === 'entrada' || l.tipo === 'aporte' },
  { id: 'saiu', rotulo: 'Saiu', aceita: (l) => l.tipo === 'saida' },
  { id: 'contas', rotulo: 'Contas pagas', aceita: (l, c) => Boolean(c) },
  { id: 'retirada', rotulo: 'Pra mim', aceita: (l) => l.tipo === 'retirada' },
];

export const ESTILO_TIPO = {
  entrada: { sinal: '+', cor: 'text-entrada', fundo: 'bg-entrada', icone: 'mais', nome: 'Venda' },
  aporte: { sinal: '+', cor: 'text-entrada', fundo: 'bg-entrada', icone: 'mais', nome: 'Dinheiro do dono' },
  saida: { sinal: '−', cor: 'text-saida', fundo: 'bg-saida', icone: 'menos', nome: 'Gasto do negócio' },
  retirada: { sinal: '−', cor: 'text-retirada', fundo: 'bg-retirada', icone: 'pessoa', nome: 'Retirada pessoal' },
};

const POR_PAGINA = 60;

// Conta que este lançamento pagou (boleto avulso ou conta fixa descoberta).
export function contaPagaPor(l, contas) {
  if (!l.contaId) return null;
  if (String(l.contaId).startsWith('auto:')) return { descricao: l.descricao, fixa: true };
  const c = contas.find((x) => x.id === l.contaId);
  return c ? { descricao: c.descricao, fixa: c.recorrente } : null;
}

export default function Extrato({ dados, hoje, acoes }) {
  const [filtro, setFiltro] = useState('tudo');
  const [aberto, setAberto] = useState(null);
  const [limite, setLimite] = useState(POR_PAGINA);

  const f = FILTROS.find((x) => x.id === filtro);
  const lista = [...dados.lancamentos]
    .filter((l) => l.data <= hoje && f.aceita(l, contaPagaPor(l, dados.contas)))
    .sort((a, b) => b.data.localeCompare(a.data) || String(b.id).localeCompare(String(a.id)));
  const visiveis = lista.slice(0, limite);

  const dias = [];
  for (const l of visiveis) {
    if (dias.at(-1)?.data !== l.data) dias.push({ data: l.data, itens: [] });
    dias.at(-1).itens.push(l);
  }

  const mes = mesDe(hoje);
  const doMes = totais(dados.lancamentos, `${mes}-01`, hoje);

  return (
    <div className="space-y-4">
      <section className="cartao p-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-tinta-3">{nomeMes(mes)} até hoje</h2>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Resumo rotulo="Entrou" valor={doMes.entrou} cor="text-entrada" />
          <Resumo rotulo="Saiu" valor={doMes.saiu} cor="text-saida" />
          <Resumo rotulo="Pra mim" valor={doMes.retiradas} cor="text-retirada" />
        </div>
      </section>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist">
        {FILTROS.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={filtro === x.id}
            onClick={() => {
              setFiltro(x.id);
              setLimite(POR_PAGINA);
            }}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${
              filtro === x.id ? 'border-marca bg-marca text-white' : 'border-borda text-tinta-2'
            }`}
          >
            {x.rotulo}
          </button>
        ))}
      </div>

      {dias.length === 0 && <p className="py-6 text-center text-sm text-tinta-2">Nenhuma movimentação aqui ainda.</p>}

      {dias.map((d) => (
        <section key={d.data}>
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-tinta-3">
            {d.data === hoje ? 'Hoje' : d.data === somarDias(hoje, -1) ? 'Ontem' : quandoTexto(d.data, hoje)}
          </h3>
          <ul className="cartao divide-y divide-borda">
            {d.itens.map((l) => (
              <Linha
                key={l.id}
                l={l}
                conta={contaPagaPor(l, dados.contas)}
                aberto={aberto === l.id}
                alternar={() => setAberto(aberto === l.id ? null : l.id)}
                acoes={acoes}
              />
            ))}
          </ul>
        </section>
      ))}

      {lista.length > limite && (
        <button onClick={() => setLimite(limite + POR_PAGINA)} className="w-full rounded-xl border border-borda py-3 font-semibold text-tinta-2">
          Mostrar mais ({lista.length - limite})
        </button>
      )}
    </div>
  );
}

function Resumo({ rotulo, valor, cor }) {
  return (
    <div className="rounded-xl bg-fundo p-2">
      <div className={`num text-base font-bold ${cor}`}>{reaisCurto(valor)}</div>
      <div className="text-xs text-tinta-3">{rotulo}</div>
    </div>
  );
}

export function Linha({ l, conta, aberto, alternar, acoes }) {
  const e = ESTILO_TIPO[l.tipo] || ESTILO_TIPO.saida;
  const [escolhendo, setEscolhendo] = useState(false);
  return (
    <li>
      <button onClick={alternar} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={aberto}>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${e.fundo} text-white`} aria-hidden="true">
          <Icone nome={conta ? 'contas' : e.icone} tamanho={17} traco={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{l.descricao}</span>
          <span className="flex flex-wrap items-center gap-1 text-xs text-tinta-3">
            {l.meio || (l.origem === 'banco' ? 'Banco' : 'Dinheiro vivo')} · {conta ? 'Conta paga' : l.categoria}
            {l.revisar && <Selo cor="bg-atencao-fundo text-atencao-texto">confira</Selo>}
            {l.simulado && <Selo cor="bg-fundo text-tinta-3">simulado</Selo>}
          </span>
        </span>
        <span className={`num shrink-0 text-sm font-bold ${e.cor}`}>
          {e.sinal} {reais(l.valor)}
        </span>
      </button>

      {aberto && (
        <div className="space-y-2 bg-fundo px-4 py-3 text-sm">
          <Detalhe rotulo="O que o app entendeu" valor={`${e.nome}${l.tipo === 'saida' ? ` · ${l.categoria}` : ''}`} />
          {conta && <Detalhe rotulo="Pagou a conta" valor={`${conta.descricao}${conta.fixa ? ' (conta fixa)' : ''}`} />}
          {l.motivo && <Detalhe rotulo="Por quê" valor={l.motivo} />}
          <Detalhe rotulo="Origem" valor={l.origem === 'banco' ? (l.simulado ? 'Banco (simulado)' : 'Extrato do banco') : 'Anotado à mão'} />

          {l.origem === 'banco' && (l.tipo === 'saida' || l.tipo === 'retirada') && !escolhendo && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => acoes.confirmar(l.id, { tipo: 'retirada', categoria: CATEGORIA_RETIRADA })}
                className="rounded-lg border border-retirada py-2 text-xs font-semibold text-retirada"
              >
                É pessoal
              </button>
              <button onClick={() => setEscolhendo(true)} className="rounded-lg border border-saida py-2 text-xs font-semibold text-saida">
                É do negócio
              </button>
            </div>
          )}
          {escolhendo && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {CATEGORIAS_SAIDA.map((c) => (
                <button
                  key={c}
                  onClick={() => (acoes.confirmar(l.id, { tipo: 'saida', categoria: c }), setEscolhendo(false))}
                  className="rounded-full border border-borda bg-superficie px-2.5 py-1 text-xs text-tinta-2"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          {l.origem !== 'banco' && (
            <button onClick={() => acoes.apagarLancamento(l.id)} className="text-xs font-semibold text-critico">
              Apagar este lançamento
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function Selo({ cor, children }) {
  return <span className={`rounded px-1.5 py-px text-[11px] font-semibold ${cor}`}>{children}</span>;
}

function Detalhe({ rotulo, valor }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-tinta-3">{rotulo}</span>
      <span className="text-right font-medium">{valor}</span>
    </div>
  );
}
