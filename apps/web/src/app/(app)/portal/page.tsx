import { apiFetch } from '@/lib/api';
import { UploadItem } from './upload-item';
import { BibliotecaPanel, LibraryDoc } from '../biblioteca-panel';

interface Overview {
  companies: Array<{ id: string; razaoSocial: string; nomeFantasia: string | null }>;
  openRequests: number;
}

interface PortalRequest {
  id: string;
  title: string;
  message: string | null;
  dueDate: string | null;
  status: string;
  company: { razaoSocial: string };
  items: Array<{ id: string; name: string; status: string; rejectionReason: string | null }>;
}

interface PortalDocument {
  id: string;
  name: string;
  category: string | null;
  competence: string | null;
  createdAt: string;
  company: { razaoSocial: string };
  versions: Array<{ version: number; size: number }>;
  requestItem: { name: string; status: string } | null;
}

const fmtDate = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

export default async function PortalPage() {
  const [overview, requests, documents] = await Promise.all([
    apiFetch<Overview>('/portal/overview'),
    apiFetch<PortalRequest[]>('/portal/requests'),
    apiFetch<PortalDocument[]>('/portal/documents'),
  ]);

  const pending = requests.filter((r) => r.status === 'ABERTA' || r.status === 'PARCIAL');
  const done = requests.filter((r) => r.status === 'CONCLUIDA');

  const libraryDocs: LibraryDoc[] = documents.map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    competence: d.competence,
    createdAt: d.createdAt,
    version: d.versions[0]?.version ?? 1,
    companyName: d.company.razaoSocial,
  }));
  const multiCompany = overview.companies.length > 1;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-brand-700">Portal do Cliente</h1>
      <p className="mb-6 text-sm text-gray-600">
        {overview.companies.map((c) => c.razaoSocial).join(' · ')}
        {overview.openRequests > 0
          ? ` — ${overview.openRequests} solicitação(ões) aguardando seus documentos`
          : ' — tudo em dia ✓'}
      </p>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
      {pending.length === 0 && (
        <div className="rounded-xl border border-green-100 bg-green-50 p-5 text-sm text-green-800">
          Nenhum documento pendente. Quando o escritório solicitar algo, aparecerá aqui e você
          também receberá um e-mail.
        </div>
      )}

      {pending.map((request) => (
        <section key={request.id} className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-800">{request.title}</h2>
            {request.dueDate && (
              <span className="text-sm text-gray-500">
                Prazo: <strong>{fmtDate(request.dueDate)}</strong>
              </span>
            )}
          </div>
          <p className="mb-4 text-xs text-gray-500">{request.company.razaoSocial}</p>
          {request.message && <p className="mb-4 text-sm italic text-gray-600">"{request.message}"</p>}

          <ul className="space-y-3">
            {request.items.map((item) => (
              <li key={item.id} className="rounded-lg border border-gray-100 p-3">
                <UploadItem
                  itemId={item.id}
                  name={item.name}
                  status={item.status}
                  rejectionReason={item.rejectionReason}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {done.length > 0 && (
        <p className="mb-6 text-sm text-gray-500">
          ✓ {done.length} solicitação(ões) concluída(s) — todos os documentos conferidos e aprovados.
        </p>
      )}
      </div>

      <BibliotecaPanel
        documents={libraryDocs}
        downloadBase="/portal/documents"
        showCompany={multiCompany}
      />
      </div>
    </div>
  );
}
