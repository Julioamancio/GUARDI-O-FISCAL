import { bibliotecaLabel } from '@guardiao/shared';
import { apiFetch } from '@/lib/api';
import { DownloadButton } from '../solicitacoes/[id]/review-actions';
import { DocumentViewLink } from '../document-viewer';
import { CategoryMenu } from '../category-menu';
import { UploadDocForm } from './documents-actions';

interface DocumentRow {
  id: string;
  name: string;
  category: string | null;
  competence: string | null;
  createdAt: string;
  company: { id: string; razaoSocial: string };
  uploadedBy: { id: string; name: string } | null;
  versions: Array<{ version: number; size: number; createdAt: string }>;
  requestItem: { id: string; name: string; status: string } | null;
}

const fmtDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const fmtSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; competence?: string; category?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.companyId) query.set('companyId', params.companyId);
  if (params.competence) query.set('competence', params.competence);
  if (params.category) query.set('category', params.category);

  const [documents, companiesResp] = await Promise.all([
    apiFetch<DocumentRow[]>(`/documents?${query.toString()}`),
    apiFetch<{ items: Array<{ id: string; razaoSocial: string }> }>('/companies?perPage=100'),
  ]);
  const companies = companiesResp.items;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-700">Central de documentos</h1>
        <span className="text-sm text-gray-500">{documents.length} documento(s)</span>
      </div>

      <UploadDocForm companies={companies} />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="companyId" className="mb-1 block text-xs font-medium text-gray-500">
            Empresa
          </label>
          <select id="companyId" name="companyId" defaultValue={params.companyId ?? ''} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todas</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.razaoSocial}
              </option>
            ))}
          </select>
        </div>
        <div className="w-64">
          <label className="mb-1 block text-xs font-medium text-gray-500">Tipo de documento</label>
          <CategoryMenu name="category" value={params.category ?? ''} allowAll allowGroup />
        </div>
        <div>
          <label htmlFor="competence" className="mb-1 block text-xs font-medium text-gray-500">
            Competência
          </label>
          <input
            id="competence"
            name="competence"
            defaultValue={params.competence ?? ''}
            placeholder="2026-08"
            pattern="\d{4}-\d{2}"
            className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Filtrar
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Competência</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Versão</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3 text-right">Baixar</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Nenhum documento com estes filtros — envie pelo botão acima ou aguarde os envios
                  dos clientes pelo portal.
                </td>
              </tr>
            )}
            {documents.map((doc) => {
              const latest = doc.versions[0];
              return (
                <tr key={doc.id} className="border-b border-gray-100 last:border-0 hover:bg-brand-50/40">
                  <td className="px-4 py-3">
                    <DocumentViewLink documentId={doc.id} downloadBase="/documents">
                      📄 {doc.name}
                    </DocumentViewLink>
                    {doc.category && (
                      <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-xs text-brand-700">
                        {bibliotecaLabel(doc.category)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{doc.company.razaoSocial}</td>
                  <td className="px-4 py-3 font-mono text-xs">{doc.competence ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {doc.requestItem ? `Portal (${doc.requestItem.name})` : (doc.uploadedBy?.name ?? '—')}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {latest ? `v${latest.version} · ${fmtSize(latest.size)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(doc.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <DownloadButton documentId={doc.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-400">
        🔒 Downloads usam links seguros que expiram em 5 minutos; cada download fica registrado na auditoria.
      </p>
    </div>
  );
}
