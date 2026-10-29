import Icone from './Icone.jsx';

// Cor de status sempre acompanhada de ícone e rótulo (nunca só a cor).
export const ESTILO_STATUS = {
  verde: { fundo: 'bg-bom-fundo', cor: 'text-bom', borda: 'border-bom', icone: 'ok', rotulo: 'Tranquilo' },
  amarelo: { fundo: 'bg-atencao-fundo', cor: 'text-atencao-texto', borda: 'border-atencao', icone: 'alerta', rotulo: 'Atenção' },
  vermelho: { fundo: 'bg-critico-fundo', cor: 'text-critico', borda: 'border-critico', icone: 'pare', rotulo: 'Perigo' },
};

const NIVEL_PARA_COR = { alto: 'vermelho', medio: 'amarelo', info: 'info' };

export function Semaforo({ sem, compacto = false }) {
  const e = ESTILO_STATUS[sem.cor];
  return (
    <div className={`rounded-2xl border-2 ${e.borda} ${e.fundo} p-4`} role="status">
      <div className="flex items-start gap-3">
        <div className="flex gap-1.5 pt-1" aria-hidden="true">
          {['vermelho', 'amarelo', 'verde'].map((c) => (
            <span
              key={c}
              className={`block h-3.5 w-3.5 rounded-full ${c === sem.cor ? `${ESTILO_STATUS[c].cor} bg-current` : 'bg-borda'}`}
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${e.cor}`}>
            <Icone nome={e.icone} tamanho={14} traco={2.5} /> {e.rotulo} · próximos 30 dias
          </div>
          <div className="mt-0.5 text-lg font-bold leading-tight text-tinta">{sem.titulo}</div>
          {!compacto && <p className="mt-1 text-sm text-tinta-2">{sem.texto}</p>}
        </div>
      </div>
    </div>
  );
}

export function CartaoAlerta({ alerta }) {
  const cor = NIVEL_PARA_COR[alerta.nivel];
  const e = ESTILO_STATUS[cor] || { fundo: 'bg-marca-suave', cor: 'text-marca', icone: 'info' };
  return (
    <li className={`flex gap-3 rounded-xl ${e.fundo} p-3`}>
      <Icone nome={e.icone} className={`mt-0.5 shrink-0 ${e.cor}`} tamanho={20} />
      <div className="min-w-0 text-sm">
        <div className="font-semibold text-tinta">{alerta.titulo}</div>
        <p className="text-tinta-2">{alerta.texto}</p>
        {alerta.sugestao && <p className="mt-1 font-medium text-tinta">{alerta.sugestao}</p>}
      </div>
    </li>
  );
}
