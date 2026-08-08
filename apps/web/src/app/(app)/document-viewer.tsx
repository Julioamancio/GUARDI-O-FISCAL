'use client';

import { ReactNode, useEffect, useState } from 'react';
import { clientApi } from '@/lib/client-api';

interface ViewData {
  url: string;
  name: string;
  version: number;
  mimeType: string;
}

/**
 * Visualizador de documento embutido: clique no nome abre o arquivo dentro do
 * sistema (PDF e imagens renderizam; outros formatos oferecem o download).
 * Usado pela equipe (/documents) e pelo cliente no portal (/portal/documents).
 */
export function DocumentViewLink({
  documentId,
  downloadBase,
  className,
  children,
}: {
  documentId: string;
  /** '/documents' (equipe) ou '/portal/documents' (cliente). */
  downloadBase: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? 'text-left font-medium text-gray-800 hover:text-brand-700 hover:underline'}
        title="Clique para visualizar"
      >
        {children}
      </button>
      {open && (
        <ViewerModal documentId={documentId} downloadBase={downloadBase} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function ViewerModal({
  documentId,
  downloadBase,
  onClose,
}: {
  documentId: string;
  downloadBase: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ViewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let alive = true;
    clientApi<ViewData>(`${downloadBase}/${documentId}/download?inline=true`)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [documentId, downloadBase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  async function download() {
    setDownloading(true);
    try {
      const { url } = await clientApi<{ url: string }>(`${downloadBase}/${documentId}/download`);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  const isPdf = data?.mimeType === 'application/pdf';
  const isImage = data?.mimeType.startsWith('image/');

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto flex h-[92vh] w-[min(1100px,94vw)] flex-col self-center rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ marginTop: '4vh' }}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900">📄 {data?.name ?? 'Carregando...'}</p>
            {data && <p className="text-xs text-gray-500">versão {data.version} · visualização segura (expira em 5 min)</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={download}
              disabled={downloading}
              className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {downloading ? '...' : '⬇ Baixar'}
            </button>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-hidden rounded-b-2xl bg-gray-100">
          {error && (
            <div className="flex h-full items-center justify-center p-8 text-sm text-red-700">{error}</div>
          )}
          {!error && !data && (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Abrindo documento...
            </div>
          )}
          {data && isPdf && <iframe src={data.url} title={data.name} className="h-full w-full border-0" />}
          {data && isImage && (
            <div className="flex h-full items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.url} alt={data.name} className="max-h-full max-w-full rounded-lg shadow" />
            </div>
          )}
          {data && !isPdf && !isImage && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="text-5xl">📦</span>
              <p className="text-sm text-gray-600">
                Este formato ({data.mimeType}) não tem visualização no navegador.
              </p>
              <button
                onClick={download}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                ⬇ Baixar o arquivo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
