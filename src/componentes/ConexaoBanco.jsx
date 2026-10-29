import { lazy, Suspense, useEffect, useState } from 'react';
import Icone from './Icone.jsx';
import { statusConexao, pedirTokenConexao, explicarFalhaItem } from '../lib/conexao.js';
import { reais } from '../lib/formato.js';

// O widget da Pluggy só é baixado quando o dono toca em "Conectar".
const PluggyConnect = lazy(() => import('react-pluggy-connect').then((m) => ({ default: m.PluggyConnect })));

// Erros conhecidos da Pluggy traduzidos para o dono do negócio.
export function mensagemErroConexao(texto, sandbox) {
  const t = String(texto || '');
  if (t.includes('TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED'))
    return sandbox
      ? 'A conta da Pluggy deste app está em período de teste: só os bancos de teste da Pluggy podem ser conectados. Escolha um banco de teste na lista.'
      : 'A conta da Pluggy deste app está em período de teste e ainda não pode conectar bancos reais. Ative os bancos de teste (PLUGGY_SANDBOX=1) ou libere o uso em produção no painel da Pluggy.';
  return t || 'A conexão não foi concluída';
}

export function tempoDesde(iso) {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} dia(s)`;
}

export default function ConexaoBanco({ dados, acoes, sincronizando }) {
  const banco = dados.config.banco;
  const [servidor, setServidor] = useState(null);
  const [token, setToken] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    statusConexao().then(setServidor);
  }, []);

  async function abrirWidget(itemId) {
    setErro('');
    try {
      setToken(await pedirTokenConexao(itemId));
    } catch (e) {
      setErro(mensagemErroConexao(e.message, servidor?.sandbox));
    }
  }

  const conectadoReal = banco && !banco.demo && banco.itemId;

  return (
    <section className="cartao space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icone nome="banco" tamanho={18} /> Conta do banco
      </h2>

      {banco ? (
        <div className="rounded-xl bg-fundo p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold">
            <span className="h-2.5 w-2.5 rounded-full bg-bom" aria-hidden="true" /> {banco.nome}
            {banco.demo && <span className="font-normal text-tinta-3">(dados simulados)</span>}
          </div>
          <div className="mt-1 text-tinta-2">
            Saldo no banco: <b className="num">{reais(banco.saldo)}</b> · atualizado {tempoDesde(banco.atualizadoEm)}
          </div>
        </div>
      ) : (
        <p className="text-sm text-tinta-2">
          Conecte a conta onde o dinheiro do negócio entra e sai. Vendas, gastos, retiradas e contas fixas passam a aparecer
          sozinhos, sem precisar anotar.
        </p>
      )}

      {conectadoReal && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => acoes.sincronizar({ atualizarAgora: true })}
            disabled={sincronizando}
            className="rounded-xl bg-marca py-3 font-bold text-white disabled:opacity-50"
          >
            {sincronizando ? 'Atualizando…' : 'Atualizar agora'}
          </button>
          <button onClick={() => abrirWidget(banco.itemId)} className="rounded-xl border border-borda py-3 font-semibold">
            Reconectar
          </button>
        </div>
      )}

      {!conectadoReal && servidor?.configurado && (
        <button onClick={() => abrirWidget()} className="w-full rounded-xl bg-marca py-3 font-bold text-white">
          Conectar meu banco
        </button>
      )}
      {!conectadoReal && servidor && !servidor.configurado && (
        <>
          {!banco?.demo && (
            <button onClick={acoes.carregarDemo} className="w-full rounded-xl bg-marca py-3 font-bold text-white">
              Conectar banco de demonstração
            </button>
          )}
          <p className="text-xs text-tinta-3">
            A conexão com bancos reais (Open Finance, via Pluggy) é ativada quando o app é publicado com as chaves da
            Pluggy. Veja docs/DECISOES.md.
          </p>
        </>
      )}

      {banco && (
        <button
          onClick={() => confirm('Desconectar o banco? Os lançamentos já importados continuam no app.') && acoes.desconectarBanco()}
          className="w-full text-sm font-semibold text-critico"
        >
          Desconectar
        </button>
      )}

      {erro && <p className="text-sm text-critico">{erro}</p>}
      <p className="text-xs text-tinta-3">
        Acesso somente leitura, autorizado no app do seu banco. O Caixa Claro não movimenta dinheiro.
      </p>

      {token && (
        <Suspense fallback={null}>
          <PluggyConnect
            connectToken={token}
            includeSandbox={Boolean(servidor?.sandbox)}
            updateItem={conectadoReal ? banco.itemId : undefined}
            language="pt"
            onSuccess={({ item }) => {
              setToken(null);
              acoes.sincronizar({ itemId: item.id });
            }}
            products={['ACCOUNTS', 'TRANSACTIONS']}
            onError={(e) => {
              setToken(null);
              const item = e?.data?.item;
              setErro(explicarFalhaItem(item) || mensagemErroConexao(e?.message, servidor?.sandbox));
              // Se a conexão foi criada e parte dos dados chegou, aproveita o que veio.
              if (item?.id && ['PARTIAL_SUCCESS', 'SUCCESS'].includes(item.executionStatus)) acoes.sincronizar({ itemId: item.id });
            }}
            onClose={() => setToken(null)}
            onEvent={(ev) => {
              // o erro de conta em teste pode chegar só como evento do widget
              if (JSON.stringify(ev || {}).includes('TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED'))
                setErro(mensagemErroConexao('TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED', servidor?.sandbox));
            }}
          />
        </Suspense>
      )}
    </section>
  );
}
