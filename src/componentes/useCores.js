import { useEffect, useState } from 'react';

// Os gráficos (SVG) não aceitam var(--x) em atributos, então lemos os tokens já resolvidos
// e relemos quando o tema claro/escuro do sistema muda.
const NOMES = ['tinta', 'tinta-2', 'tinta-3', 'grade', 'superficie', 'borda', 'marca', 'entrada', 'saida', 'retirada', 'critico', 'bom'];

function ler() {
  const s = getComputedStyle(document.documentElement);
  return Object.fromEntries(NOMES.map((n) => [n, s.getPropertyValue(`--${n}`).trim()]));
}

export default function useCores() {
  const [cores, setCores] = useState(ler);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const atualizar = () => setCores(ler());
    mq.addEventListener('change', atualizar);
    return () => mq.removeEventListener('change', atualizar);
  }, []);
  return cores;
}
