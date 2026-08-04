import Link from 'next/link';
import { apiFetch } from '@/lib/api';

interface SearchResults {
  query: string;
  companies: Array<{ id: string; razaoSocial: string; cnpj: string }>;
  tasks: Array<{ id: string; title: string; competence: string; status: string; company: { razaoSocial: string } }>;
  documents: Array<{ id: string; name: string; competence: string | null; company: { razaoSocial: string } }>;
  requests: Array<{ id: string; title: string; status: string; company: { razaoSocial: string } }>;
  users: Array<{ id: string; name: string; email: string }>;
}

export default async function BuscaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const results =
    query.length >= 2 ? await apiFetch<SearchResults>(`/search?q=${encodeURIComponent(query)}`) : null;

  const total = results
    ? results.companies.length + results.tasks.length + results.documents.length + results.requests.length + results.users.length
    : 0;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-brand-700">Pesquisa</h1>
      <form method="get" className="mb-6 flex gap-2">
        <input
          name="q"
          defaultValue={query}
          autoFocus
          placeholder="Empresa, CNPJ, tarefa, documento, solicitação, usuário..."
          className="w-full max-w-xl rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Buscar
        </button>
      </form>

      {results && (
        <p className="mb-4 text-sm text-gray-500">
          {total} resultado(s) para "{results.query}"
        </p>
      )}

      {results && results.companies.length > 0 && (
        <Section title="Empresas">
          {results.companies.map((c) => (
            <Link key={c.id} href={`/empresas/${c.id}`} className="block rounded-lg px-3 py-2 hover:bg-brand-50">
              <span className="font-medium text-brand-700">{c.razaoSocial}</span>
              <span className="ml-2 font-mono text-xs text-gray-500">{c.cnpj}</span>
            </Link>
          ))}
        </Section>
      )}

      {results && results.tasks.length > 0 && (
        <Section title="Tarefas">
          {results.tasks.map((t) => (
            <Link key={t.id} href={`/tarefas?competence=${t.competence}`} className="block rounded-lg px-3 py-2 hover:bg-brand-50">
              <span className="font-medium text-gray-800">{t.title}</span>
              <span className="ml-2 text-xs text-gray-500">
                {t.company.razaoSocial} · {t.competence} · {t.status.replaceAll('_', ' ').toLowerCase()}
              </span>
            </Link>
          ))}
        </Section>
      )}

      {results && results.requests.length > 0 && (
        <Section title="Solicitações de documentos">
          {results.requests.map((r) => (
            <Link key={r.id} href={`/solicitacoes/${r.id}`} className="block rounded-lg px-3 py-2 hover:bg-brand-50">
              <span className="font-medium text-gray-800">{r.title}</span>
              <span className="ml-2 text-xs text-gray-500">
                {r.company.razaoSocial} · {r.status.toLowerCase()}
              </span>
            </Link>
          ))}
        </Section>
      )}

      {results && results.documents.length > 0 && (
        <Section title="Documentos">
          {results.documents.map((d) => (
            <div key={d.id} className="px-3 py-2">
              <span className="font-medium text-gray-800">📄 {d.name}</span>
              <span className="ml-2 text-xs text-gray-500">
                {d.company.razaoSocial}
                {d.competence && ` · ${d.competence}`}
              </span>
            </div>
          ))}
        </Section>
      )}

      {results && results.users.length > 0 && (
        <Section title="Usuários">
          {results.users.map((u) => (
            <div key={u.id} className="px-3 py-2">
              <span className="font-medium text-gray-800">{u.name}</span>
              <span className="ml-2 text-xs text-gray-500">{u.email}</span>
            </div>
          ))}
        </Section>
      )}

      {results && total === 0 && (
        <p className="text-sm text-gray-500">Nada encontrado. Tente parte do nome, do CNPJ ou da competência (YYYY-MM).</p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <h2 className="mb-1 px-3 text-xs font-semibold uppercase text-gray-500">{title}</h2>
      {children}
    </section>
  );
}
