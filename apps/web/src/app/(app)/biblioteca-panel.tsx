'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { BIBLIOTECA, BibliotecaItem } from '@guardiao/shared';
import { clientApi } from '@/lib/client-api';

export interface LibraryDoc {
  id: string;
  name: string;
  category: string | null;
  competence: string | null;
  createdAt: string;
  version: number;
  companyName?: string;
}

const fmtDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

/**
 * Biblioteca de documentos por empresa — painel lateral com menu dropdown por
 * tipo de documento. Usado na tela da empresa (admin/contador, com upload) e no
 * portal do cliente (somente leitura/download).
 */
export function BibliotecaPanel({
  documents,
  downloadBase,
  companyId,
  showCompany,
}: {
  documents: LibraryDoc[];
  /** '/documents' (equipe) ou '/portal/documents' (cliente) — caminho no proxy. */
  downloadBase: string;
  /** Presente = pode enviar arquivos (equipe). Ausente = somente leitura (portal). */
  companyId?: string;
  showCompany?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (slug: string) => setOpen((s) => ({ ...s, [slug]: !s[slug] }));

  const docsFor = (item: BibliotecaItem): LibraryDoc[] => {
    if (item.children) {
      return documents.filter(
        (d) => d.category === item.slug || item.children!.some((c) => c.slug === d.category),
      );
    }
    return documents.filter((d) => d.category === item.slug);
  };

  const knownSlugs = new Set(
    BIBLIOTECA.flatMap((c) => [c.slug, ...(c.children?.map((x) => x.slug) ?? [])]),
  );
  const uncategorized = documents.filter((d) => !d.category || !knownSlugs.has(d.category));

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 className="font-semibold text-gray-800">📚 Biblioteca de documentos</h2>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
          {documents.length}
        </span>
      </div>

      <ul className="divide-y divide-gray-50">
        {BIBLIOTECA.map((cat) => {
          const docs = docsFor(cat);
          return (
            <li key={cat.slug}>
              <CategoryRow
                item={cat}
                count={docs.length}
                openState={open}
                onToggle={toggle}
                documents={documents}
                downloadBase={downloadBase}
                companyId={companyId}
                showCompany={showCompany}
              />
            </li>
          );
        })}

        {uncategorized.length > 0 && (
          <li>
            <button
              onClick={() => toggle('__outros')}
              className="flex w-full items-center justify-between px-5 py-3 text-left text-sm hover:bg-gray-50"
            >
              <span className="flex items-center gap-2 font-medium text-gray-700">
                <span>📁</span> Outros documentos
              </span>
              <span className="flex items-center gap-2">
                <CountBadge count={uncategorized.length} />
                <Chevron open={!!open.__outros} />
              </span>
            </button>
            {open.__outros && (
              <DocList docs={uncategorized} downloadBase={downloadBase} showCompany={showCompany} />
            )}
          </li>
        )}
      </ul>
    </section>
  );
}

function CategoryRow({
  item,
  count,
  openState,
  onToggle,
  documents,
  downloadBase,
  companyId,
  showCompany,
  depth = 0,
}: {
  item: BibliotecaItem;
  count: number;
  openState: Record<string, boolean>;
  onToggle: (slug: string) => void;
  documents: LibraryDoc[];
  downloadBase: string;
  companyId?: string;
  showCompany?: boolean;
  depth?: number;
}) {
  const isOpen = !!openState[item.slug];
  const ownDocs = documents.filter((d) => d.category === item.slug);

  return (
    <div>
      <button
        onClick={() => onToggle(item.slug)}
        className={`flex w-full items-center justify-between py-3 pr-5 text-left text-sm hover:bg-gray-50 ${
          depth > 0 ? 'pl-10' : 'pl-5'
        }`}
      >
        <span className={`flex items-center gap-2 ${depth > 0 ? 'text-gray-600' : 'font-medium text-gray-700'}`}>
          {item.icon && <span>{item.icon}</span>}
          {item.label}
        </span>
        <span className="flex items-center gap-2">
          <CountBadge count={count} />
          <Chevron open={isOpen} />
        </span>
      </button>

      {isOpen && (
        <div className={depth > 0 ? 'pl-5' : ''}>
          {item.children ? (
            <ul>
              {item.children.map((child) => (
                <li key={child.slug}>
                  <CategoryRow
                    item={child}
                    count={documents.filter((d) => d.category === child.slug).length}
                    openState={openState}
                    onToggle={onToggle}
                    documents={documents}
                    downloadBase={downloadBase}
                    companyId={companyId}
                    showCompany={showCompany}
                    depth={depth + 1}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <>
              <DocList docs={ownDocs} downloadBase={downloadBase} showCompany={showCompany} indent={depth > 0} />
              {companyId && <UploadInto companyId={companyId} category={item.slug} indent={depth > 0} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DocList({
  docs,
  downloadBase,
  showCompany,
  indent,
}: {
  docs: LibraryDoc[];
  downloadBase: string;
  showCompany?: boolean;
  indent?: boolean;
}) {
  if (docs.length === 0) {
    return <p className={`pb-2 text-xs text-gray-400 ${indent ? 'pl-10' : 'pl-5'}`}>Nenhum arquivo ainda.</p>;
  }
  return (
    <ul className={`pb-2 pr-5 ${indent ? 'pl-10' : 'pl-5'}`}>
      {docs.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between gap-2 py-1.5">
          <span className="min-w-0 flex-1 truncate text-xs text-gray-700" title={doc.name}>
            📄 {doc.name}
            <span className="ml-1.5 text-[11px] text-gray-400">
              v{doc.version} · {fmtDate(doc.createdAt)}
              {doc.competence ? ` · ${doc.competence}` : ''}
              {showCompany && doc.companyName ? ` · ${doc.companyName}` : ''}
            </span>
          </span>
          <DownloadButton documentId={doc.id} downloadBase={downloadBase} />
        </li>
      ))}
    </ul>
  );
}

function DownloadButton({ documentId, downloadBase }: { documentId: string; downloadBase: string }) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const { url } = await clientApi<{ url: string }>(`${downloadBase}/${documentId}/download`);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={download}
      disabled={busy}
      className="shrink-0 rounded-md border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-brand-700 hover:border-brand-500 hover:bg-brand-50 disabled:opacity-50"
    >
      {busy ? '...' : '⬇ Baixar'}
    </button>
  );
}

function UploadInto({ companyId, category, indent }: { companyId: string; category: string; indent?: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('companyId', companyId);
      body.append('category', category);
      const response = await fetch('/api/proxy/documents/upload', { method: 'POST', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? 'Falha no upload');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className={`pb-3 pr-5 ${indent ? 'pl-10' : 'pl-5'}`}>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-50"
      >
        {busy ? 'Enviando...' : '+ Enviar arquivo'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        count > 0 ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-400'
      }`}
    >
      {count}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
