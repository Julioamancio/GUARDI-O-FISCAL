import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { DownloadButton, ReviewButtons, ToggleReminders } from './review-actions';

interface RequestDetail {
  id: string;
  title: string;
  message: string | null;
  competence: string | null;
  dueDate: string | null;
  status: string;
  remindersEnabled: boolean;
  company: { id: string; razaoSocial: string };
  createdBy: { name: string } | null;
  items: Array<{
    id: string;
    name: string;
    status: string;
    rejectionReason: string | null;
    reviewedBy: { name: string } | null;
    reviewedAt: string | null;
    documents: Array<{
      id: string;
      name: string;
      versions: Array<{ version: number; size: number; createdAt: string }>;
    }>;
  }>;
  reminders: Array<{ id: string; stage: string; sentAt: string }>;
}

const ITEM_BADGE: Record<string, string> = {
  PENDENTE: 'bg-gray-100 text-gray-600',
  RECEBIDO: 'bg-blue-50 text-blue-700',
  APROVADO: 'bg-green-50 text-green-700',
  REJEITADO: 'bg-red-50 text-red-700',
};

const fmtDate = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const fmtSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

export default async function SolicitacaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let request: RequestDetail;
  try {
    request = await apiFetch<RequestDetail>(`/document-requests/${id}`);
  } catch {
    notFound();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/solicitacoes" className="text-xs text-gray-500 hover:text-brand-700">
            ← Solicitações
          </Link>
          <h1 className="text-2xl font-bold text-brand-700">{request.title}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {request.company.razaoSocial}
            {request.competence && ` · competência ${request.competence}`}
            {` · prazo ${fmtDate(request.dueDate)}`}
            {request.createdBy && ` · solicitado por ${request.createdBy.name}`}
          </p>
          {request.message && <p className="mt-2 text-sm italic text-gray-500">"{request.message}"</p>}
        </div>
        <ToggleReminders requestId={request.id} enabled={request.remindersEnabled} status={request.status} />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-800">Itens solicitados</h2>
        <ul className="space-y-4">
          {request.items.map((item) => (
            <li key={item.id} className="rounded-lg border border-gray-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ITEM_BADGE[item.status]}`}>
                    {item.status.toLowerCase()}
                  </span>
                  <span className="font-medium text-gray-800">{item.name}</span>
                </div>
                {item.status === 'RECEBIDO' && <ReviewButtons itemId={item.id} />}
              </div>

              {item.status === 'REJEITADO' && item.rejectionReason && (
                <p className="mt-2 text-sm text-red-700">
                  Rejeitado: {item.rejectionReason} — o cliente foi avisado para reenviar.
                </p>
              )}
              {item.reviewedBy && item.status === 'APROVADO' && (
                <p className="mt-2 text-xs text-gray-500">
                  Aprovado por {item.reviewedBy.name} em {fmtDate(item.reviewedAt)}
                </p>
              )}

              {item.documents.map((doc) => (
                <div key={doc.id} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span className="text-gray-700">
                    📄 {doc.name}
                    {doc.versions[0] && (
                      <span className="ml-2 text-xs text-gray-500">
                        v{doc.versions[0].version} · {fmtSize(doc.versions[0].size)} · {fmtDate(doc.versions[0].createdAt)}
                      </span>
                    )}
                  </span>
                  <DownloadButton documentId={doc.id} />
                </div>
              ))}
            </li>
          ))}
        </ul>
      </section>

      {request.reminders.length > 0 && (
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-800">Cobranças enviadas</h2>
          <ul className="space-y-1 text-sm text-gray-600">
            {request.reminders.map((reminder) => (
              <li key={reminder.id}>
                {fmtDate(reminder.sentAt)} — estágio{' '}
                {reminder.stage.startsWith('ATRASO') ? 'em atraso' : reminder.stage.replace('D', 'D-')}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
