import { BRAND_NAME } from '../lib/brand';

/** Rodapé padrão da plataforma: créditos + acesso ao manual. */
export function Footer() {
  return (
    <footer className="mt-10 border-t border-gray-200 bg-white">
      <div className="flex w-full flex-col items-center justify-between gap-2 px-8 py-4 text-xs text-gray-500 sm:flex-row">
        <p className="text-center sm:text-left">
          {BRAND_NAME} — Gestão e Prova para Escritórios de Contabilidade · Todos os direitos
          reservados · Feito por Júlio Amâncio · © 2026
        </p>
        <a
          href="https://claude.ai/code/artifact/b34d4ade-8ef7-4012-b7e1-9107c5c3988c"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-brand-500 px-3 py-1.5 font-semibold text-brand-700 hover:bg-brand-50"
        >
          📖 Manual de uso
        </a>
      </div>
    </footer>
  );
}
