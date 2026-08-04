'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clientApi } from '@/lib/client-api';

/** Aprovar/rejeitar item recebido (rejeição exige motivo — o cliente o verá). */
export function ReviewButtons({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(status: 'APROVADO' | 'REJEITADO') {
    let rejectionReason: string | undefined;
    if (status === 'REJEITADO') {
      const reason = window.prompt('Motivo da rejeição (o cliente verá este texto):');
      if (!reason?.trim()) return;
      rejectionReason = reason.trim();
    }
    setBusy(true);
    setError(null);
    try {
      await clientApi(`/document-requests/items/${itemId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, rejectionReason }),
      });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        onClick={() => review('APROVADO')}
        disabled={busy}
        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
      >
        ✓ Aprovar
      </button>
      <button
        onClick={() => review('REJEITADO')}
        disabled={busy}
        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        ✕ Rejeitar
      </button>
    </div>
  );
}

/** Abre o link assinado temporário em nova aba. */
export function DownloadButton({ documentId, portal = false }: { documentId: string; portal?: boolean }) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const path = portal ? `/portal/documents/${documentId}/download` : `/documents/${documentId}/download`;
      const { url } = await clientApi<{ url: string }>(path);
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

/** Pausar/retomar cobranças automáticas da solicitação. */
export function ToggleReminders({
  requestId,
  enabled,
  status,
}: {
  requestId: string;
  enabled: boolean;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (status === 'CONCLUIDA' || status === 'CANCELADA') return null;

  async function toggle() {
    setBusy(true);
    try {
      await clientApi(`/document-requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify({ remindersEnabled: !enabled }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
        enabled
          ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
          : 'border-gray-300 text-gray-500 hover:bg-gray-50'
      }`}
    >
      {enabled ? '⏸ Pausar cobranças' : '▶ Retomar cobranças'}
    </button>
  );
}
