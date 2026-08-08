'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { clientApi } from '@/lib/client-api';
import { CategoryMenu } from '../category-menu';

const STATUS_INFO: Record<string, { label: string; className: string }> = {
  PENDENTE: { label: 'Aguardando envio', className: 'bg-amber-50 text-amber-700' },
  RECEBIDO: { label: 'Enviado — em conferência', className: 'bg-blue-50 text-blue-700' },
  APROVADO: { label: 'Aprovado ✓', className: 'bg-green-50 text-green-700' },
  REJEITADO: { label: 'Reenvio necessário', className: 'bg-red-50 text-red-700' },
};

/** Item da solicitação no portal: status + upload (ou reenvio) do arquivo. */
export function UploadItem({
  itemId,
  name,
  status,
  rejectionReason,
}: {
  itemId: string;
  name: string;
  status: string;
  rejectionReason: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const info = STATUS_INFO[status] ?? STATUS_INFO.PENDENTE;
  const canUpload = status === 'PENDENTE' || status === 'REJEITADO' || status === 'RECEBIDO';

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('category', category);
      const response = await fetch(`/api/proxy/portal/items/${itemId}/upload`, { method: 'POST', body });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(Array.isArray(data.message) ? data.message.join('; ') : (data.message ?? 'Falha no envio'));
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${info.className}`}>{info.label}</span>
          <span className="font-medium text-gray-800">{name}</span>
        </div>
        {canUpload && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Tipo de documento OBRIGATÓRIO — define em qual pasta/categoria o arquivo entra */}
            <div className="w-56">
              <CategoryMenu
                value={category}
                onChange={(v) => {
                  setCategory(v);
                  setError(null);
                }}
                placeholder="Tipo de documento *"
                highlightEmpty
                compact
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.xml,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.zip,.txt,.ofx"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <button
              onClick={() => {
                if (!category) {
                  setError('Selecione primeiro o tipo de documento — é ele que define a pasta certa do arquivo.');
                  return;
                }
                fileRef.current?.click();
              }}
              disabled={busy}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Enviando...' : status === 'PENDENTE' ? '📤 Enviar arquivo' : '📤 Reenviar'}
            </button>
          </div>
        )}
      </div>
      {status === 'REJEITADO' && rejectionReason && (
        <p className="mt-2 text-sm text-red-700">Motivo: {rejectionReason}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <p className="mt-1 text-xs text-gray-400">
        Formatos aceitos: PDF, XML, XLS(X), CSV, JPG, PNG, ZIP, TXT, OFX · até 25 MB
      </p>
    </div>
  );
}

/** Download no portal (link assinado temporário). */
export function PortalDownloadButton({ documentId }: { documentId: string }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const { url } = await clientApi<{ url: string }>(`/portal/documents/${documentId}/download`);
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
      className="rounded-lg border border-brand-500 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
    >
      {busy ? '...' : 'Baixar'}
    </button>
  );
}
