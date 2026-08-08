'use client';

import { useEffect, useRef, useState } from 'react';
import { BIBLIOTECA, bibliotecaLabel } from '@guardiao/shared';

/**
 * Menu de tipos de documento em DOIS NÍVEIS de verdade: "Declarações" fica
 * fechada e expande num submenu ao clicar. Substitui o <select> nativo (que só
 * suporta cabeçalhos de grupo) no filtro da Central, no envio da equipe e no
 * portal do cliente.
 *
 * Funciona dentro de <form> nativo via input hidden (prop name) e também
 * controlado via onChange.
 */
export function CategoryMenu({
  name,
  value: initialValue,
  onChange,
  placeholder = 'Selecione o tipo...',
  allowAll = false,
  allowGroup = false,
  highlightEmpty = false,
  compact = false,
}: {
  /** Nome do input hidden para formulários GET/POST nativos. */
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  /** Mostra a opção "Todos" (filtros). */
  allowAll?: boolean;
  /** Permite escolher o grupo inteiro (ex.: "Todas as declarações", nos filtros). */
  allowGroup?: boolean;
  /** Borda âmbar enquanto vazio (obrigatório no portal). */
  highlightEmpty?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [value, setValue] = useState(initialValue ?? '');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function select(v: string) {
    setValue(v);
    onChange?.(v);
    setOpen(false);
  }

  const display = value
    ? BIBLIOTECA.find((c) => c.slug === value && c.children)
      ? `📋 Todas as ${bibliotecaLabel(value).toLowerCase()}`
      : bibliotecaLabel(value)
    : allowAll
      ? 'Todos'
      : placeholder;

  const base = compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm';
  const border = highlightEmpty && !value ? 'border-amber-400 text-amber-700' : 'border-gray-300 text-gray-700';

  const itemCls = (active: boolean, indent = false) =>
    `flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
      indent ? 'pl-9' : ''
    } ${active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-700 hover:bg-gray-50'}`;

  return (
    <div ref={rootRef} className="relative inline-block w-full min-w-52">
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white ${base} ${border} hover:border-brand-500`}
      >
        <span className="truncate">{display}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-1.5 max-h-96 w-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl">
          {allowAll && (
            <button type="button" onClick={() => select('')} className={itemCls(value === '')}>
              <span>Todos</span>
            </button>
          )}
          {BIBLIOTECA.map((cat) =>
            cat.children ? (
              <div key={cat.slug}>
                {/* Nível 1: abre o submenu, não seleciona */}
                <button
                  type="button"
                  onClick={() => setExpanded((e) => (e === cat.slug ? null : cat.slug))}
                  className={itemCls(value.startsWith(cat.slug))}
                >
                  <span>
                    {cat.icon} {cat.label}
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded === cat.slug ? 'rotate-90' : ''}`} aria-hidden>
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
                {/* Nível 2: submenu com os tipos de declaração */}
                {expanded === cat.slug && (
                  <div className="ml-3 border-l-2 border-brand-100">
                    {allowGroup && (
                      <button type="button" onClick={() => select(cat.slug)} className={itemCls(value === cat.slug, true)}>
                        <span>Todas as {cat.label.toLowerCase()}</span>
                      </button>
                    )}
                    {cat.children.map((child) => (
                      <button
                        key={child.slug}
                        type="button"
                        onClick={() => select(child.slug)}
                        className={itemCls(value === child.slug, true)}
                      >
                        <span>{child.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button key={cat.slug} type="button" onClick={() => select(cat.slug)} className={itemCls(value === cat.slug)}>
                <span>
                  {cat.icon} {cat.label}
                </span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
