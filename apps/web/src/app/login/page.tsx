'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { GlassDust } from './glass-dust';

const input =
  'w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30';

const BENEFITS = [
  {
    icon: '📅',
    title: 'Nenhuma obrigação esquecida',
    text: 'O calendário fiscal gera as tarefas de cada empresa sozinho, todo mês — já contando feriados e dias úteis.',
  },
  {
    icon: '📨',
    title: 'Documentos sem WhatsApp perdido',
    text: 'O sistema cobra seu cliente automaticamente até ele enviar tudo pelo portal. Você só confere e aprova.',
  },
  {
    icon: '🛡️',
    title: 'Prova de quem fez o quê',
    text: 'Linha do tempo imutável de cada empresa: pedidos, cobranças, envios e conferências — exportável em PDF.',
  },
  {
    icon: '🚦',
    title: 'O mês inteiro em um olhar',
    text: 'Painel de fechamento com semáforo por empresa e departamento. Vermelho? Você age antes da multa.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...(isSuperadmin ? {} : { tenantSlug: tenantSlug.trim().toLowerCase() }),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? 'Falha no login');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen">
      {/* Painel de apresentação */}
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 p-12 text-white lg:flex">
        {/* poeira + bola de vidro seguindo o cursor */}
        <GlassDust />
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-500/40 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <img
            src="/mascote.svg"
            alt="Mascote do Guardião Fiscal"
            className="h-12 w-12 object-contain drop-shadow-lg"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <p className="text-2xl font-bold tracking-tight">Guardião Fiscal</p>
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-4xl font-bold leading-tight">
            O escritório contábil que{' '}
            <span className="underline decoration-brand-100/60 decoration-4 underline-offset-4">
              nunca perde um prazo
            </span>
            .
          </h1>
          <p className="mt-4 text-lg text-brand-50/90">
            Central de obrigações, documentos e prova de responsabilidade para escritórios de
            contabilidade — funcionando sozinha enquanto você atende seus clientes.
          </p>

          <ul className="mt-8 space-y-4">
            {BENEFITS.map((benefit) => (
              <li key={benefit.title} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-lg backdrop-blur">
                  {benefit.icon}
                </span>
                <span>
                  <span className="block font-semibold">{benefit.title}</span>
                  <span className="block text-sm text-brand-50/80">{benefit.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-end justify-end">
          <img
            src="/mascote.svg"
            alt=""
            aria-hidden
            className="pointer-events-none -mb-6 -mr-2 h-56 w-auto object-contain drop-shadow-2xl"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>
      </section>

      {/* Cartão de entrada */}
      <section className="flex w-full items-center justify-center bg-gray-50 p-6 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <img
              src="/mascote.svg"
              alt=""
              className="mx-auto mb-3 h-24 w-auto object-contain"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <h1 className="text-3xl font-bold text-brand-700">Guardião Fiscal</h1>
            <p className="mt-2 text-sm text-gray-600">
              Nenhuma obrigação esquecida. Nenhum documento perdido.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg shadow-brand-900/5">
            <h2 className="text-xl font-bold text-gray-900">Bem-vindo de volta 👋</h2>
            <p className="mb-6 mt-1 text-sm text-gray-500">
              {isSuperadmin
                ? 'Acesso do administrador da plataforma.'
                : 'Entre com os dados do seu escritório.'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isSuperadmin && (
                <div>
                  <label htmlFor="tenant" className="mb-1 block text-sm font-medium text-gray-700">
                    Escritório
                  </label>
                  <input
                    id="tenant"
                    type="text"
                    required
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    placeholder="ex.: demo"
                    autoComplete="organization"
                    className={input}
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className={input}
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className={input}
                />
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? 'Entrando...' : 'Entrar no meu escritório'}
              </button>

              <label className="flex cursor-pointer items-center justify-center gap-2 pt-1 text-xs text-gray-500">
                <input
                  type="checkbox"
                  checked={isSuperadmin}
                  onChange={(e) => setIsSuperadmin(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Sou administrador da plataforma
              </label>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            Ainda não tem acesso? Fale com quem administra a plataforma para criar o seu
            escritório com 14 dias de teste.
          </p>
        </div>
      </section>
    </main>
  );
}
