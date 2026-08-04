'use client';

/**
 * Cliente da API para componentes de navegador. Chama /api/proxy (que injeta o
 * Bearer dos cookies httpOnly). Em 401, tenta renovar a sessão UMA vez e
 * repete; se falhar, envia para o login.
 */
export async function clientApi<T>(path: string, init?: RequestInit): Promise<T> {
  const doFetch = () =>
    fetch(`/api/proxy${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });

  let response = await doFetch();
  if (response.status === 401) {
    const refreshed = await fetch('/api/session', { method: 'PUT' });
    if (refreshed.ok) {
      response = await doFetch();
    }
  }
  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = Array.isArray(body.message) ? body.message.join('; ') : body.message;
    throw new Error(message ?? `Erro ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
