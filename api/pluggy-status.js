import { configurado, sandbox } from './_pluggy.js';

// O app pergunta se a conexão real está disponível; se não, oferece o banco de demonstração.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ configurado: configurado(), sandbox: sandbox() });
}
