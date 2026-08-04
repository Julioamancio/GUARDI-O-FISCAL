import 'server-only';
import { cookies } from 'next/headers';

/**
 * Cliente da API para Server Components e Route Handlers.
 * Dentro do Docker a web fala com a API pela rede interna (API_INTERNAL_URL);
 * em desenvolvimento local usa NEXT_PUBLIC_API_URL.
 */
export function apiBaseUrl(): string {
  return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('gf_access')?.value;

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });

  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? `Erro ${response.status} na API`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Sessão expirada');
    this.name = 'UnauthorizedError';
  }
}
