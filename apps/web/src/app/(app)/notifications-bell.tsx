'use client';

import { useEffect, useRef, useState } from 'react';
import { clientApi } from '@/lib/client-api';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

const fmt = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return new Date(iso).toLocaleDateString('pt-BR');
};

/** Sino de notificações: contador de não lidas + painel suspenso. */
export function NotificationsBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      setItems(await clientApi<Notification[]>('/notifications?limit=20'));
    } catch {
      /* sem sessão ou rede — sino fica vazio */
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 60_000);
    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      clearInterval(timer);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const unread = items.filter((n) => !n.readAt).length;

  async function markRead(notification: Notification) {
    if (notification.readAt) return;
    try {
      await clientApi(`/notifications/${notification.id}/read`, { method: 'PATCH' });
      setItems((current) =>
        current.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
    } catch {
      /* silencioso */
    }
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Notificações${unread > 0 ? ` (${unread} não lidas)` : ''}`}
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-brand-700"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M10.268 21a2 2 0 0 0 3.464 0" />
          <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 max-h-96 w-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
          <p className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase text-gray-500">
            Notificações
          </p>
          {items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-500">Nada por aqui ainda.</p>
          )}
          <ul>
            {items.map((notification) => (
              <li key={notification.id}>
                <button
                  onClick={() => markRead(notification)}
                  className={`block w-full px-4 py-3 text-left hover:bg-gray-50 ${
                    notification.readAt ? 'opacity-60' : ''
                  }`}
                >
                  <span className="flex items-start gap-2">
                    {!notification.readAt && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-800">
                        {notification.title}
                      </span>
                      {notification.body && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-gray-500">
                          {notification.body}
                        </span>
                      )}
                      <span className="mt-0.5 block text-[11px] text-gray-400">
                        {fmt(notification.createdAt)}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
