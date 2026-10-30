import { useState } from 'react';
import Icone from '../componentes/Icone.jsx';
import { SIMULACOES } from '../lib/simulador.js';
import { lerValor } from '../lib/formato.js';

// Modo apresentação: gera movimentos como se tivessem acontecido no banco conectado,
// para mostrar ao vivo o que o app faz sozinho com cada um.
export default function Simular({ dados, acoes }) {
  const [resultado, setResultado] = useState(null);
  const [valor, setValor] = useState('');
  const [nome, setNome] = useState('');
  const temSimuladas = dados.lancamentos.some((l) => l.simulado);
  const temHistorico = dados.config.banco?.demo || dados.lancamentos.some((l) => l.idExterno?.startsWith('sim-hist-'));

  function simular(tipo) {
    const personalizado = { valor: lerValor(valor) || undefined, nome: nome.trim().toUpperCase() || undefined };
    setResultado(acoes.simular(tipo, personalizado));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-marca-suave p-3 text-sm text-tinta-2">
        <b className="text-tinta">Modo apresentação.</b> Cada botão cria um movimento como se tivesse acontecido no{' '}
        <b>{dados.config.banco?.nome || 'banco'}</b>. Ele passa pelo mesmo processamento do extrato real e fica marcado
        como <i>simulado</i>.
      </div>

      <section className="cartao space-y-2 p-4">
        <h2 className="font-semibold">Simular movimento do banco</h2>
        {SIMULACOES.map((s) => (
          <button
            key={s.id}
            onClick={() => simular(s.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-borda px-3 py-3 text-left font-medium active:scale-[.99]"
          >
            <Icone nome={s.icone} tamanho={20} className="text-marca" />
            {s.rotulo}
          </button>
        ))}
        <details className="pt-1 text-sm">
          <summary className="cursor-pointer text-tinta-2">Escolher valor e nome (opcional)</summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              inputMode="decimal"
              placeholder="Valor (R$)"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="num rounded-xl border border-borda bg-transparent px-3 py-2 outline-none focus:border-marca"
            />
            <input
              placeholder="Nome (cliente/fornecedor)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="rounded-xl border border-borda bg-transparent px-3 py-2 outline-none focus:border-marca"
            />
          </div>
        </details>
      </section>

      {resultado && (
        <section className={`rounded-2xl p-4 text-sm ${resultado.ok ? 'bg-bom-fundo' : 'bg-atencao-fundo'}`} role="status">
          <div className="font-semibold text-tinta">{resultado.titulo}</div>
          <ul className="mt-1 space-y-0.5 text-tinta-2">
            {resultado.linhas.map((l) => (
              <li key={l}>• {l}</li>
            ))}
          </ul>
          {resultado.ok && (
            <div className="mt-3 flex gap-4">
              <button onClick={() => acoes.irPara('extrato')} className="font-semibold text-marca">
                Ver no extrato →
              </button>
              <button onClick={() => acoes.irPara('inicio')} className="font-semibold text-marca">
                Ver no início →
              </button>
            </div>
          )}
        </section>
      )}

      <section className="cartao space-y-2 p-4">
        <h2 className="font-semibold">Histórico para os gráficos</h2>
        <p className="text-sm text-tinta-2">
          Cria 3 meses de movimento de um pet shop (vendas, fornecedor, aluguel, energia, água, internet, DAS e retiradas).
          O app descobre sozinho as contas fixas.
        </p>
        <button
          onClick={() => setResultado(acoes.gerarHistorico())}
          disabled={temHistorico}
          className="w-full rounded-xl bg-marca py-3 font-bold text-white disabled:opacity-40"
        >
          {temHistorico ? 'Já tem 3 meses de histórico' : 'Gerar 3 meses de histórico'}
        </button>
      </section>

      {temSimuladas && (
        <button
          onClick={() => confirm('Apagar todos os movimentos simulados?') && (acoes.limparSimuladas(), setResultado(null))}
          className="w-full text-sm font-semibold text-critico"
        >
          Apagar movimentos simulados
        </button>
      )}
    </div>
  );
}
