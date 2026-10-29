// Ícones em linha (traço), para não depender de biblioteca externa.
const CAMINHOS = {
  inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  lancar: 'M12 5v14M5 12h14',
  contas: 'M7 3h10a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1zM9 8h6M9 12h6',
  previsao: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  ajustes: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  mais: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  pessoa: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  ok: 'M5 13l4 4L19 7',
  alerta: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  pare: 'M8 3h8l5 5v8l-5 5H8l-5-5V8zM12 8v5M12 16v.5',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7.5v.5',
  sino: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4',
  lixo: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  voltar: 'M15 18l-6-6 6-6',
  repetir: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  calendario: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4',
};

export default function Icone({ nome, tamanho = 22, className = '', traco = 2 }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={traco}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}
