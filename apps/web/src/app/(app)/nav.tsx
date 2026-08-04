'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const STAFF_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/empresas', label: 'Empresas' },
  { href: '/tarefas', label: 'Tarefas' },
  { href: '/solicitacoes', label: 'Solicitações' },
];

const CLIENT_LINKS = [{ href: '/portal', label: 'Portal' }];

export function Nav({
  userName,
  tenantName,
  isSuperadmin,
  isClient,
}: {
  userName: string;
  tenantName: string;
  isSuperadmin: boolean;
  isClient: boolean;
}) {
  const LINKS = isClient ? CLIENT_LINKS : STAFF_LINKS;
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    await fetch('/api/session', { method: 'DELETE' }).catch(() => undefined);
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-lg font-bold text-brand-700">
            🛡️ Guardião Fiscal
          </Link>
          {!isSuperadmin && (
            <nav className="flex items-center gap-1">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    pathname.startsWith(link.href)
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-gray-800">{userName}</p>
            <p className="text-xs text-gray-500">{tenantName}</p>
          </div>
          <button
            onClick={logout}
            disabled={leaving}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-60"
          >
            {leaving ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </div>
    </header>
  );
}
