import Icone from '../componentes/Icone.jsx';
import { Semaforo, CartaoAlerta } from '../componentes/Status.jsx';
import { alertas, resumoDoDia, saldoAtual, semaforo, totais } from '../lib/financas.js';
import { mesDe, nomeMes } from '../lib/datas.js';
import { paraRevisar } from '../lib/banco.js';
import { tempoDesde } from '../componentes/ConexaoBanco.jsx';
import { reais, reaisCurto } from '../lib/formato.js';

export default function Inicio({ dados, hoje, acoes, sincronizando }) {
  const sem = semaforo(dados, hoje);
  const resumo = resumoDoDia(dados, hoje);
  const lista = alertas(dados, hoje).filter((a) => a.id !== 'amanha'); // "amanhã vence" já está no resumo
  const mes = mesDe(hoje);
  const doMes = totais(dados.lancamentos, `${mes}-01`, hoje);
  const saldo = saldoAtual(dados, hoje);
  const maxBarra = Math.max(doMes.lucro, doMes.retiradas, 1);
  const banco = dados.config.banco;
  const conferir = paraRevisar(dados);

  return (
    <div className="space-y-4">
      <button className="block w-full text-left" onClick={() => acoes.irPara('previsao')}>
        <Semaforo sem={sem} />
      </button>

      {banco ? (
        <button
          onClick={() => acoes.irPara('ajustes')}
          className="flex w-full items-center gap-2 text-left text-xs text-tinta-3"
        >
          <Icone nome="banco" tamanho={16} />
          <span className="min-w-0 flex-1 truncate">
            {banco.nome} conectado · {sincronizando ? 'atualizando…' : `atualizado ${tempoDesde(banco.atualizadoEm)}`}
          </span>
          <span className="font-semibold text-marca">Atualizar</span>
        </button>
      ) : null}
      {banco && (
        <button onClick={() => acoes.irPara('simular')} className="-mt-2 block text-xs font-semibold text-marca">
          + Simular movimento do banco (apresentação)
        </button>
      )}
      {!banco && (
        <button
          onClick={() => acoes.irPara('ajustes')}
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-marca p-4 text-left"
        >
          <Icone nome="banco" className="shrink-0 text-marca" />
          <span className="text-sm">
            <b className="text-marca">Conecte seu banco</b> e pare de anotar: vendas, gastos e contas entram sozinhos.
          </span>
        </button>
      )}

      {conferir.length > 0 && (
        <button
          onClick={() => acoes.irPara('confira')}
          className="flex w-full items-center gap-3 rounded-2xl bg-atencao-fundo p-4 text-left"
        >
          <Icone nome="alerta" className="shrink-0 text-atencao-texto" />
          <span className="min-w-0 flex-1 text-sm">
            <b>Confira {conferir.length === 1 ? '1 lançamento' : `${conferir.length} lançamentos`} do banco</b>
            <span className="block text-tinta-2">O app não teve certeza se é do negócio ou pessoal. 1 toque cada.</span>
          </span>
          <span className="font-semibold text-atencao-texto">Ver</span>
        </button>
      )}

      {banco && <p className="text-xs font-semibold uppercase tracking-wide text-tinta-3">Anotar dinheiro vivo</p>}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => acoes.irPara('lancar', 'entrada')}
          className="flex items-center justify-center gap-2 rounded-2xl bg-entrada py-5 text-lg font-bold text-white shadow-sm active:scale-[.98]"
        >
          <Icone nome="mais" traco={3} /> Entrou
        </button>
        <button
          onClick={() => acoes.irPara('lancar', 'saida')}
          className="flex items-center justify-center gap-2 rounded-2xl bg-saida py-5 text-lg font-bold text-white shadow-sm active:scale-[.98]"
        >
          <Icone nome="menos" traco={3} /> Saiu
        </button>
        <button
          onClick={() => acoes.irPara('lancar', 'retirada')}
          className="col-span-2 flex items-center justify-center gap-2 rounded-2xl border-2 border-retirada py-3 font-semibold text-retirada active:scale-[.98]"
        >
          <Icone nome="pessoa" tamanho={20} /> Tirei dinheiro para mim
        </button>
      </div>

      <section className="cartao p-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-tinta-3">Resumo de hoje</h2>
        <ul className="mt-2 space-y-2 text-[15px]">
          <li className="flex gap-2">
            <Icone nome="calendario" tamanho={20} className="mt-0.5 shrink-0 text-tinta-3" />
            {resumo.contasAmanha.length ? (
              <span>
                <b>Amanhã vence:</b>{' '}
                {resumo.contasAmanha.map((c) => `${c.descricao} ${reaisCurto(c.valor)}`).join(', ')}
              </span>
            ) : (
              <span className="text-tinta-2">Nenhuma conta vence amanhã</span>
            )}
          </li>
          <li className="flex gap-2">
            <Icone nome="ok" tamanho={20} className="mt-0.5 shrink-0 text-tinta-3" />
            <span>
              <b>Hoje sobrou {reaisCurto(resumo.sobrou)}</b>{' '}
              <span className="text-tinta-2">
                (entrou {reaisCurto(resumo.entrou)}, saiu {reaisCurto(resumo.saiu)})
              </span>
            </span>
          </li>
          <li className="flex gap-2">
            <Icone nome="inicio" tamanho={20} className="mt-0.5 shrink-0 text-tinta-3" />
            <span>
              Dinheiro em caixa agora: <b className="num">{reais(saldo)}</b>
            </span>
          </li>
        </ul>
      </section>

      {lista.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-tinta-3">Precisa de atenção</h2>
          <ul className="space-y-2">
            {lista.map((a) => (
              <CartaoAlerta key={a.id} alerta={a} />
            ))}
          </ul>
        </section>
      )}

      <section className="cartao p-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-tinta-3">
          Negócio x bolso · {nomeMes(mes)} até hoje
        </h2>
        <div className="mt-3 space-y-3">
          <Barra rotulo="O negócio lucrou" valor={doMes.lucro} max={maxBarra} cor="bg-entrada" />
          <Barra rotulo="Você retirou para si" valor={doMes.retiradas} max={maxBarra} cor="bg-retirada" />
        </div>
        <p className="mt-3 text-sm text-tinta-2">
          {doMes.retiradas > doMes.lucro
            ? `Você tirou ${reaisCurto(doMes.retiradas - doMes.lucro)} a mais do que o negócio gerou. Esse dinheiro está saindo do caixa.`
            : `Ainda cabe ${reaisCurto(doMes.lucro - doMes.retiradas)} de retirada sem mexer no caixa da empresa.`}
        </p>
      </section>
    </div>
  );
}

function Barra({ rotulo, valor, max, cor }) {
  const pct = Math.max(0, (valor / max) * 100);
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-tinta-2">{rotulo}</span>
        <span className="num font-semibold">{reaisCurto(valor)}</span>
      </div>
      <div className="mt-1 h-2.5 rounded-full bg-fundo">
        <div className={`h-2.5 rounded-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
