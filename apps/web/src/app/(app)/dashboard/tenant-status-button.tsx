'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clientApi } from '@/lib/client-api';

/** Suspender/reativar escritório (superadmin). Suspensão bloqueia o login de todos. */
export function TenantStatusButton({
  tenantId,
  status,
  name,
}: {
  tenantId: string;
  status: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const suspended = status === 'SUSPENDED';

  async function toggle() {
    const action = suspended ? 'REATIVAR' : 'SUSPENDER';
    if (!window.confirm(`${action} o escritório "${name}"? ${suspended ? 'Os usuários voltarão a entrar.' : 'Ninguém deste escritório conseguirá entrar.'}`)) {
      return;
    }
    setBusy(true);
    try {
      await clientApi(`/admin/tenants/${tenantId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: suspended ? 'ACTIVE' : 'SUSPENDED' }),
      });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (status === 'CANCELED') return <span className="text-xs text-gray-400">cancelado</span>;

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${
        suspended
          ? 'border-green-300 text-green-700 hover:bg-green-50'
          : 'border-red-300 text-red-700 hover:bg-red-50'
      }`}
    >
      {busy ? '...' : suspended ? '▶ Reativar' : '⏸ Suspender'}
    </button>
  );
}
