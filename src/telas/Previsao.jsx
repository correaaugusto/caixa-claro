import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Semaforo } from '../componentes/Status.jsx';
import useCores from '../componentes/useCores.js';
import {
  evolucaoMensal,
  gastosPorCategoria,
  projecao,
  saldoAtual,
  semaforo,
  totais,
} from '../lib/financas.js';
import { diaMes, diaSemana, mesDe, nomeMes } from '../lib/datas.js';
import { reais, reaisCurto } from '../lib/formato.js';

const eixoReais = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : v);

export default function Previsao({ dados, hoje }) {
  const cores = useCores();
  const [menosRetirada, setMenosRetirada] = useState(0);
  const [maisEntrada, setMaisEntrada] = useState(0);
  const simulando = menosRetirada > 0 || maisEntrada > 0;

  const base = projecao(dados, hoje);
  const ajustada = projecao(dados, hoje, 30, { menosRetiradaMes: menosRetirada, maisEntradaMes: maisEntrada });
  const sem = semaforo(dados, hoje, simulando ? ajustada : base);
  const m = base.medias;
  const retiradaMes = Math.round((m.retirada * 30) / 50) * 50;

  const serie = base.pontos.map((p, i) => ({
    data: p.data,
    rotulo: i === 0 ? 'hoje' : diaMes(p.data),
    atual: p.saldo,
    ajustado: ajustada.pontos[i].saldo,
    contas: p.contas,
  }));

  const mes = mesDe(hoje);
  const doMes = totais(dados.lancamentos, `${mes}-01`, hoje);
  const gastos = gastosPorCategoria(dados.lancamentos, `${mes}-01`, hoje);
  const maiorGasto = gastos[0]?.valor || 1;
  const evolucao = evolucaoMensal(dados.lancamentos, hoje).map((e) => ({ ...e, nome: nomeMes(e.mes) }));

  const estiloEixo = { fontSize: 11, fill: cores['tinta-3'] };

  return (
    <div className="space-y-4">
      <Semaforo sem={sem} />

      <section className="cartao p-4">
        <h2 className="font-semibold">Saldo previsto nos próximos 30 dias</h2>
        <p className="text-xs text-tinta-3">Toque no gráfico para ver o saldo de cada dia e as contas que vencem.</p>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke={cores.grade} vertical={false} />
              <XAxis dataKey="rotulo" tick={estiloEixo} tickLine={false} axisLine={{ stroke: cores.borda }} interval={6} />
              <YAxis tick={estiloEixo} tickLine={false} axisLine={false} tickFormatter={eixoReais} width={52} />
              <ReferenceLine
                y={0}
                stroke={cores.critico}
                strokeDasharray="4 4"
                label={{ value: 'R$ 0', position: 'insideBottomLeft', fill: cores.critico, fontSize: 11 }}
              />
              <Tooltip content={<DicaSaldo simulando={simulando} />} cursor={{ stroke: cores['tinta-3'], strokeWidth: 1 }} />
              <Line
                type="linear"
                dataKey="atual"
                name="Ritmo atual"
                stroke={cores.marca}
                strokeWidth={2}
                dot={(p) =>
                  p.payload.contas.length ? (
                    <circle key={p.key} cx={p.cx} cy={p.cy} r={4} fill={cores.marca} stroke={cores.superficie} strokeWidth={2} />
                  ) : (
                    <g key={p.key} />
                  )
                }
                activeDot={{ r: 5, stroke: cores.superficie, strokeWidth: 2 }}
                isAnimationActive={false}
              />
              {simulando && (
                <Line
                  type="linear"
                  dataKey="ajustado"
                  name="Com o ajuste"
                  stroke={cores.bom}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 5, stroke: cores.superficie, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              )}
              {simulando && <Legend verticalAlign="top" height={24} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-tinta-3">Pontos marcados = dias com conta vencendo.</p>
      </section>

      <section className="cartao p-4 text-sm">
        <h2 className="font-semibold">Como o Caixa Claro calcula</h2>
        <ul className="mt-2 space-y-1 text-tinta-2">
          <Linha rotulo="Dinheiro em caixa hoje" valor={reais(saldoAtual(dados, hoje))} />
          <Linha rotulo="Entra por dia (média 30 dias)" valor={`+ ${reais(m.entrada)}`} />
          <Linha rotulo="Gastos do dia a dia" valor={`− ${reais(m.gastoVariavel)}`} />
          <Linha rotulo="Suas retiradas por dia" valor={`− ${reais(m.retirada)}`} />
          <Linha
            rotulo="Contas a pagar em 30 dias"
            valor={`− ${reais(base.contas.reduce((t, c) => t + c.valor, 0))}`}
          />
        </ul>
      </section>

      <section className="cartao p-4">
        <h2 className="font-semibold">E se…?</h2>
        <p className="text-xs text-tinta-3">Teste uma decisão e veja o efeito no caixa antes de agir.</p>
        <Controle
          rotulo="Retirar menos por mês"
          valor={menosRetirada}
          max={Math.max(retiradaMes, 500)}
          onChange={setMenosRetirada}
          ajuda={`Hoje você retira cerca de ${reaisCurto(m.retirada * 30)} por mês.`}
        />
        <Controle
          rotulo="Vender a mais por mês"
          valor={maisEntrada}
          max={3000}
          onChange={setMaisEntrada}
          ajuda="Ex.: promoção, novo serviço, reajuste de preço."
        />
        {simulando && (
          <p className="mt-3 rounded-xl bg-fundo p-3 text-sm">
            Com esse ajuste, o menor saldo do período passa de <b className="num">{reaisCurto(semaforo(dados, hoje, base).menor.saldo)}</b>{' '}
            para <b className="num">{reaisCurto(sem.menor.saldo)}</b>.{' '}
            {sem.cor === 'vermelho' ? 'Ainda falta dinheiro.' : 'O caixa deixa de ficar negativo.'}
          </p>
        )}
      </section>

      <section className="cartao p-4">
        <h2 className="font-semibold">{nomeMes(mes)} até hoje</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Bloco rotulo="Entrou" valor={doMes.entrou} cor="text-entrada" />
          <Bloco rotulo="Saiu (gastos)" valor={doMes.saiu} cor="text-saida" />
          <Bloco rotulo="Lucro do negócio" valor={doMes.lucro} />
          <Bloco rotulo="Suas retiradas" valor={doMes.retiradas} cor="text-retirada" />
        </div>
      </section>

      <section className="cartao p-4">
        <h2 className="font-semibold">Maiores gastos do mês</h2>
        {gastos.length === 0 ? (
          <p className="mt-2 text-sm text-tinta-2">Nenhum gasto anotado neste mês.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {gastos.map((g) => (
              <li key={g.categoria} title={`${g.categoria}: ${reais(g.valor)}`}>
                <div className="flex justify-between text-sm">
                  <span className="text-tinta-2">{g.categoria}</span>
                  <span className="num font-semibold">
                    {reaisCurto(g.valor)}{' '}
                    <span className="font-normal text-tinta-3">({Math.round((g.valor / doMes.saiu) * 100)}%)</span>
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-fundo">
                  <div className="h-2 rounded-full bg-saida" style={{ width: `${(g.valor / maiorGasto) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cartao p-4">
        <h2 className="font-semibold">Está melhorando ou piorando?</h2>
        <p className="text-xs text-tinta-3">Entradas e gastos por mês (o mês atual está incompleto).</p>
        <div className="mt-3 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={evolucao} margin={{ top: 4, right: 4, bottom: 0, left: -8 }} barGap={2}>
              <CartesianGrid stroke={cores.grade} vertical={false} />
              <XAxis dataKey="nome" tick={estiloEixo} tickLine={false} axisLine={{ stroke: cores.borda }} />
              <YAxis tick={estiloEixo} tickLine={false} axisLine={false} tickFormatter={eixoReais} width={52} />
              <Tooltip
                formatter={(v) => reais(v)}
                cursor={{ fill: cores.grade, opacity: 0.5 }}
                contentStyle={{ background: cores.superficie, border: `1px solid ${cores.borda}`, borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: cores.tinta, fontWeight: 600 }}
                itemStyle={{ color: cores['tinta-2'] }}
              />
              <Legend verticalAlign="top" height={24} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="entrou" name="Entrou" fill={cores.entrada} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="saiu" name="Saiu" fill={cores.saida} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="num mt-3 w-full text-sm">
          <thead>
            <tr className="text-xs text-tinta-3">
              <th className="text-left font-medium">Mês</th>
              <th className="text-right font-medium">Lucro</th>
              <th className="text-right font-medium">Retiradas</th>
            </tr>
          </thead>
          <tbody>
            {evolucao.map((e) => (
              <tr key={e.mes} className="border-t border-borda">
                <td className="py-1.5">{e.nome}</td>
                <td className={`text-right font-semibold ${e.lucro < 0 ? 'text-critico' : ''}`}>{reaisCurto(e.lucro)}</td>
                <td className="text-right text-tinta-2">{reaisCurto(e.retiradas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function DicaSaldo({ active, payload, simulando }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="cartao max-w-[220px] px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-tinta">
        {diaSemana(p.data)}, {diaMes(p.data)}
      </div>
      <div className={`num ${p.atual < 0 ? 'font-semibold text-critico' : 'text-tinta-2'}`}>Saldo: {reais(p.atual)}</div>
      {simulando && <div className="num text-tinta-2">Com ajuste: {reais(p.ajustado)}</div>}
      {p.contas.map((c) => (
        <div key={c.id + c.vencimento} className="text-tinta-3">
          − {c.descricao} {reaisCurto(c.valor)}
        </div>
      ))}
    </div>
  );
}

function Linha({ rotulo, valor }) {
  return (
    <li className="flex justify-between gap-2">
      <span>{rotulo}</span>
      <span className="num font-medium text-tinta">{valor}</span>
    </li>
  );
}

function Bloco({ rotulo, valor, cor = '' }) {
  return (
    <div className="rounded-xl bg-fundo p-3">
      <div className="text-xs text-tinta-3">{rotulo}</div>
      <div className={`num text-lg font-bold ${valor < 0 ? 'text-critico' : cor}`}>{reaisCurto(valor)}</div>
    </div>
  );
}

function Controle({ rotulo, valor, max, onChange, ajuda }) {
  return (
    <label className="mt-4 block">
      <div className="flex justify-between text-sm">
        <span>{rotulo}</span>
        <span className="num font-semibold">{reaisCurto(valor)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={50}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--marca)]"
      />
      <div className="text-xs text-tinta-3">{ajuda}</div>
    </label>
  );
}
