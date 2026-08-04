'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

const input =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

export default function SenhaPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('newPassword'));
    if (newPassword !== String(form.get('confirm'))) {
      setError('A confirmação não confere com a nova senha');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/proxy/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.get('currentPassword'),
          newPassword,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          Array.isArray(data.message) ? data.message.join('; ') : (data.message ?? 'Falha ao trocar a senha'),
        );
      }
      setDone(true);
      // Por segurança todas as sessões foram revogadas — sai e entra de novo
      await fetch('/api/session', { method: 'DELETE' }).catch(() => undefined);
      setTimeout(() => {
        router.push('/login');
        router.refresh();
      }, 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-lg font-semibold text-green-900">✓ Senha alterada!</p>
        <p className="mt-2 text-sm text-green-800">
          Por segurança, todas as suas sessões foram encerradas. Você será levado ao login para
          entrar com a nova senha...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-bold text-brand-700">Trocar senha</h1>
      <p className="mb-6 text-sm text-gray-500">
        Ao confirmar, todas as suas sessões (inclusive em outros aparelhos) serão encerradas.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Senha atual</label>
          <input name="currentPassword" type="password" required className={input} autoComplete="current-password" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nova senha</label>
          <input
            name="newPassword"
            type="password"
            required
            minLength={10}
            placeholder="10+ caracteres, com maiúscula, minúscula e número"
            className={input}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Confirmar nova senha</label>
          <input name="confirm" type="password" required minLength={10} className={input} autoComplete="new-password" />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? 'Alterando...' : 'Alterar senha'}
        </button>
      </form>
    </div>
  );
}
