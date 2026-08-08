'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { NotificationsBell } from './notifications-bell';
import { BRAND_NAME } from '../../lib/brand';

const STAFF_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/fechamento', label: 'Fechamento' },
  { href: '/empresas', label: 'Empresas' },
  { href: '/tarefas', label: 'Tarefas' },
  { href: '/solicitacoes', label: 'Solicitações' },
  { href: '/documentos', label: 'Documentos' },
];

const CLIENT_LINKS = [{ href: '/portal', label: 'Portal' }];

export function Nav({
  userName,
  tenantName,
  isSuperadmin,
  isClient,
  canManageUsers,
}: {
  userName: string;
  tenantName: string;
  isSuperadmin: boolean;
  isClient: boolean;
  canManageUsers: boolean;
}) {
  const LINKS = isClient
    ? CLIENT_LINKS
    : canManageUsers
      ? [...STAFF_LINKS, { href: '/equipe', label: 'Equipe' }]
      : STAFF_LINKS;
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    await fetch('/api/session', { method: 'DELETE' }).catch(() => undefined);
    router.push('/login');
    router.refresh();
  }

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 w-full items-center gap-5 px-6">
        {/* Marca: nunca quebra linha, logo com presença */}
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <img
            src="/logo.png"
            alt=""
            className="h-9 w-9 object-contain"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <span className="whitespace-nowrap text-lg font-bold tracking-tight text-brand-700">
            {BRAND_NAME}
          </span>
        </Link>

        {/* Navegação ocupa o espaço central */}
        {!isSuperadmin ? (
          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  pathname.startsWith(link.href)
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : (
          <div className="flex-1" />
        )}

        {/* Ações e identidade do usuário */}
        <div className="flex shrink-0 items-center gap-3">
          {!isClient && !isSuperadmin && (
            <form action="/busca" method="get" className="relative hidden lg:block">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                name="q"
                placeholder="Buscar..."
                className="w-44 rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm transition-all focus:w-64 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </form>
          )}
          <NotificationsBell />

          <div className="hidden h-8 w-px bg-gray-200 sm:block" />

          <div className="hidden items-center gap-2.5 sm:flex">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
              {initials}
            </span>
            <div className="leading-tight">
              <p className="max-w-[160px] truncate text-sm font-semibold text-gray-900">{userName}</p>
              <p className="max-w-[160px] truncate text-xs text-gray-500">
                <Link href="/senha" className="hover:text-brand-700 hover:underline">
                  trocar senha
                </Link>
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            disabled={leaving}
            title={`Sair (${tenantName})`}
            className="rounded-lg border border-gray-300 px-3.5 py-1.5 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 disabled:opacity-60"
          >
            {leaving ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </div>
    </header>
  );
}
