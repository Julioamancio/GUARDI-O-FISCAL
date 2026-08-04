'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { GlassDust } from './glass-dust';

const input =
  'w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30';

/* Ícones Lucide (lucide.dev, licença ISC) — traço fino, padrão de mercado */
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const BENEFITS = [
  {
    icon: (
      <Icon>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18" />
        <path d="m9 16 2 2 4-4" />
      </Icon>
    ),
    title: 'Prazos no piloto automático',
    text: 'DAS, FGTS, folha e todas as obrigações entram no calendário sozinhas, na data certa — com feriados e dias úteis calculados.',
  },
  {
    icon: (
      <Icon>
        <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        <path d="m16 19 2 2 4-4" />
      </Icon>
    ),
    title: 'Documentos sem perseguição',
    text: 'O sistema lembra o cliente quantas vezes for preciso e recebe tudo num portal organizado. Você só confere e aprova.',
  },
  {
    icon: (
      <Icon>
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
      </Icon>
    ),
    title: 'Prova de cada passo',
    text: 'Pedidos, cobranças, envios e aprovações ficam numa linha do tempo que ninguém apaga — e saem em PDF quando você precisar.',
  },
  {
    icon: (
      <Icon>
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
      </Icon>
    ),
    title: 'Tudo numa tela só',
    text: 'Semáforo por empresa e por departamento: o problema aparece para você antes de virar multa.',
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
            src="/logo.png"
            alt="Logo do Radar Contábil"
            className="h-11 w-11 object-contain drop-shadow-lg"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <p className="text-2xl font-bold tracking-tight">Radar Contábil</p>
        </div>

        <div className="relative flex flex-1 flex-col justify-center py-10">
          <h1 className="text-5xl font-bold leading-[1.15] tracking-tight">
            Seu escritório
            <br />
            nunca mais perde
            <br />
            <span className="text-cyan-300">um prazo.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-brand-50/90">
            O Radar Contábil vigia os vencimentos, cobra os documentos dos seus clientes e
            guarda as provas — sozinho, todos os dias, para cada empresa da sua carteira.
          </p>

          <ul className="mt-10 grid max-w-3xl grid-cols-1 gap-4 xl:grid-cols-2">
            {BENEFITS.map((benefit) => (
              <li
                key={benefit.title}
                className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-cyan-200">
                    {benefit.icon}
                  </span>
                  <span className="font-semibold">{benefit.title}</span>
                </span>
                <span className="mt-2 block text-sm leading-relaxed text-brand-50/80">
                  {benefit.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

      </section>

      {/* Cartão de entrada com o mascote ao lado */}
      <section className="flex w-full items-center justify-center bg-gray-50 p-6 lg:w-1/2">
        <img
          src="/mascote.png"
          alt="Mascote do Radar Contábil"
          className="mr-8 hidden h-96 w-auto object-contain drop-shadow-2xl md:block"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <img
              src="/logo.png"
              alt=""
              className="mx-auto mb-3 h-20 w-auto object-contain"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <h1 className="text-3xl font-bold text-brand-700">Radar Contábil</h1>
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
            ✨ Novos escritórios começam com 14 dias de teste grátis.
          </p>
        </div>
      </section>
    </main>
  );
}
