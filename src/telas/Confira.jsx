import { useState } from 'react';
import Icone from '../componentes/Icone.jsx';
import { paraRevisar } from '../lib/banco.js';
import { CATEGORIAS_SAIDA, CATEGORIA_RETIRADA } from '../lib/financas.js';
import { quandoTexto } from '../lib/datas.js';
import { reais } from '../lib/formato.js';

// O único toque que sobra: confirmar o que o app não reconheceu com segurança.
// A escolha vale para todos os lançamentos do mesmo favorecido e vira regra.
export default function Confira({ dados, hoje, acoes }) {
  const lista = paraRevisar(dados);

  if (!lista.length)
    return (
      <div className="cartao p-6 text-center">
        <Icone nome="ok" tamanho={32} className="mx-auto text-bom" />
        <p className="mt-2 font-semibold">Tudo conferido</p>
        <p className="text-sm text-tinta-2">Os lançamentos do banco estão organizados.</p>
        <button onClick={() => acoes.irPara('inicio')} className="mt-4 rounded-xl bg-marca px-5 py-2.5 font-bold text-white">
          Voltar ao início
        </button>
      </div>
    );

  return (
    <div className="space-y-3">
      <p className="text-sm text-tinta-2">
        O app organizou o extrato sozinho. Só {lista.length === 1 ? 'este precisa' : `estes ${lista.length} precisam`} da sua
        confirmação. Na próxima vez ele já vai saber.
      </p>
      {lista.map((l) => (
        <Item key={l.id} l={l} hoje={hoje} acoes={acoes} />
      ))}
    </div>
  );
}

function Item({ l, hoje, acoes }) {
  const [escolhendo, setEscolhendo] = useState(false);
  return (
    <div className="cartao p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{l.descricao}</div>
          <div className="text-xs text-tinta-3">
            {quandoTexto(l.data, hoje)} · {l.motivo}
          </div>
        </div>
        <span className="num font-semibold">{reais(l.valor)}</span>
      </div>
      {escolhendo ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIAS_SAIDA.map((c) => (
            <button
              key={c}
              onClick={() => acoes.confirmar(l.id, { tipo: 'saida', categoria: c })}
              className="rounded-full border border-borda px-3 py-1.5 text-sm text-tinta-2 hover:border-marca hover:text-marca"
            >
              {c}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => acoes.confirmar(l.id, { tipo: 'retirada', categoria: CATEGORIA_RETIRADA })}
            className={`rounded-xl border-2 py-2.5 text-sm font-semibold ${l.tipo === 'retirada' ? 'border-retirada bg-retirada text-white' : 'border-retirada text-retirada'}`}
          >
            É pessoal
          </button>
          <button
            onClick={() => setEscolhendo(true)}
            className={`rounded-xl border-2 py-2.5 text-sm font-semibold ${l.tipo === 'saida' ? 'border-saida bg-saida text-white' : 'border-saida text-saida'}`}
          >
            É do negócio
          </button>
        </div>
      )}
    </div>
  );
}
