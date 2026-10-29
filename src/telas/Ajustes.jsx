import { useState } from 'react';
import Icone from '../componentes/Icone.jsx';
import ConexaoBanco from '../componentes/ConexaoBanco.jsx';
import { saldoAtual, textoAvisoDiario } from '../lib/financas.js';
import { lerValor, reais } from '../lib/formato.js';
import { exportarCSV } from '../lib/armazenamento.js';
import { enviarAviso, pedirPermissao, permissaoAtual } from '../lib/aviso.js';

export default function Ajustes({ dados, hoje, acoes, sincronizando }) {
  const saldo = saldoAtual(dados, hoje);
  const [nome, setNome] = useState(dados.config.nomeNegocio);
  const [caixa, setCaixa] = useState(saldo.toFixed(2).replace('.', ','));
  const [permissao, setPermissao] = useState(permissaoAtual());
  const [cpf, setCpf] = useState(dados.config.dono?.cpf || '');

  function salvar(e) {
    e.preventDefault();
    // O usuário informa quanto tem em caixa hoje; ajustamos o saldo inicial para bater.
    const ajuste = lerValor(caixa) - saldo;
    acoes.salvarConfig({
      nomeNegocio: nome.trim() || 'Meu negócio',
      dono: { ...(dados.config.dono || {}), cpf: cpf.replace(/\D/g, '') },
      ...(dados.config.banco ? {} : { saldoInicial: (dados.config.saldoInicial || 0) + ajuste }),
    });
  }

  async function ativarAviso() {
    const p = await pedirPermissao();
    setPermissao(p);
    if (p === 'granted') enviarAviso(dados, hoje);
  }

  function baixarCSV() {
    const blob = new Blob(['﻿' + exportarCSV(dados)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `caixa-claro-${hoje}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4">
      <ConexaoBanco dados={dados} acoes={acoes} sincronizando={sincronizando} />

      <form onSubmit={salvar} className="cartao space-y-3 p-4">
        <h2 className="font-semibold">Seu negócio</h2>
        <label className="block text-xs text-tinta-3">
          Nome
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 w-full rounded-xl border border-borda bg-transparent px-3 py-2.5 text-base text-tinta outline-none focus:border-marca"
          />
        </label>
        {dados.config.banco ? (
          <p className="text-xs text-tinta-3">O saldo vem do banco conectado (mais o dinheiro vivo que você anotar).</p>
        ) : (
          <label className="block text-xs text-tinta-3">
            Quanto dinheiro tem no caixa hoje? (R$)
            <input
              inputMode="decimal"
              value={caixa}
              onChange={(e) => setCaixa(e.target.value)}
              className="num mt-1 w-full rounded-xl border border-borda bg-transparent px-3 py-2.5 text-base text-tinta outline-none focus:border-marca"
            />
          </label>
        )}
        <label className="block text-xs text-tinta-3">
          Seu CPF (opcional): para reconhecer quando você transfere dinheiro do negócio para você
          <input
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            className="num mt-1 w-full rounded-xl border border-borda bg-transparent px-3 py-2.5 text-base text-tinta outline-none focus:border-marca"
          />
        </label>
        <button className="w-full rounded-xl bg-marca py-3 font-bold text-white">Salvar</button>
      </form>

      <section className="cartao space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Icone nome="sino" tamanho={18} /> Aviso diário
        </h2>
        <div className="rounded-xl bg-fundo p-3 text-sm">
          <div className="mb-1 text-xs text-tinta-3">Prévia do aviso de hoje:</div>
          {textoAvisoDiario(dados, hoje).map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
        {permissao === 'granted' ? (
          <button onClick={() => enviarAviso(dados, hoje)} className="w-full rounded-xl border border-marca py-3 font-semibold text-marca">
            Enviar o aviso agora (teste)
          </button>
        ) : permissao === 'unsupported' ? (
          <p className="text-sm text-tinta-2">Este navegador não permite notificações. O resumo continua na tela inicial.</p>
        ) : (
          <button onClick={ativarAviso} className="w-full rounded-xl bg-marca py-3 font-bold text-white">
            Ativar aviso no celular
          </button>
        )}
        {permissao === 'denied' && (
          <p className="text-xs text-critico">As notificações estão bloqueadas nas configurações do navegador.</p>
        )}
        <p className="text-xs text-tinta-3">O aviso aparece uma vez por dia, quando você abre o app. Envio pelo WhatsApp é a próxima etapa.</p>
      </section>

      <section className="cartao space-y-2 p-4">
        <h2 className="font-semibold">Dados</h2>
        <p className="text-xs text-tinta-3">
          Ficam salvos só neste aparelho. {dados.lancamentos.length} lançamentos, {dados.contas.length} contas. Caixa hoje:{' '}
          {reais(saldo)}.
        </p>
        <button onClick={baixarCSV} className="w-full rounded-xl border border-borda py-3 font-semibold">
          Baixar planilha (CSV)
        </button>
        <button onClick={acoes.carregarDemo} className="w-full rounded-xl border border-borda py-3 font-semibold">
          Carregar dados de demonstração
        </button>
        <button
          onClick={() => confirm('Apagar tudo e começar do zero?') && acoes.comecarDoZero()}
          className="w-full rounded-xl border border-critico py-3 font-semibold text-critico"
        >
          Apagar tudo e começar do zero
        </button>
      </section>

      <section className="cartao p-4 text-sm text-tinta-2">
        <h2 className="mb-2 font-semibold text-tinta">Por que o Caixa Claro?</h2>
        <p>Pesquisa com 6 pequenos empresários. Entre os 4 que anotam no caderno ou de cabeça:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>4 de 4 sabem entradas e saídas só "mais ou menos";</li>
          <li>4 de 4 misturam o dinheiro pessoal com o da empresa;</li>
          <li>3 de 4 só sabem as contas do próximo mês;</li>
          <li>2 de 4 gastam de 30 min a 1 h por dia conferindo o caderno.</li>
        </ul>
        <p className="mt-2">
          5 de 6 deram nota máxima para um app que avisa se o caixa vai faltar nos próximos 30 dias. Amostra pequena:
          resultado indicativo, não estatístico.
        </p>
      </section>
    </div>
  );
}
