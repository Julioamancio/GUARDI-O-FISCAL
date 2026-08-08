'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

interface ImportResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  created: number;
  confirmed: boolean;
  errors: Array<{ line: number; error: string }>;
  preview: Array<{ razaoSocial: string; cnpj: string }>;
  portalAccess?: Array<{ empresa: string; email: string; senha?: string; obs?: string }>;
}

/**
 * Importação de planilha (CSV ou Excel) com pré-visualização obrigatória (req. 32).
 * .xlsx/.xls são convertidos para CSV no navegador; o servidor aceita cabeçalhos
 * flexíveis (EMPRESA, CNPJ/CPF, TIPO APURAÇÃO IMPOSTOS, email, contato...).
 */
export function ImportCsv() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(confirm: boolean) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      let upload: File = file;
      if (/\.xlsx?$/i.test(file.name)) {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        upload = new File([csv], file.name.replace(/\.xlsx?$/i, '.csv'), { type: 'text/csv' });
      }
      const body = new FormData();
      body.append('file', upload);
      const response = await fetch(`/api/proxy/companies/import${confirm ? '?confirm=true' : ''}`, {
        method: 'POST',
        body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? 'Falha na importação');
      setResult(data);
      if (confirm) {
        setFile(null);
        router.refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 inline-flex flex-wrap items-center gap-2 align-top">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setResult(null);
          if (e.target.files?.[0]) void 0;
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
      >
        📥 Importar planilha (Excel/CSV)
      </button>
      <a
        href="/api/proxy/companies/import/template"
        download="modelo-empresas.csv"
        className="text-xs text-gray-500 underline hover:text-brand-700"
      >
        baixar modelo
      </a>

      {file && !result && (
        <span className="flex items-center gap-2 text-sm text-gray-600">
          {file.name}
          <button
            onClick={() => send(false)}
            disabled={busy}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Validando...' : 'Validar (pré-visualização)'}
          </button>
        </span>
      )}

      {error && <span className="text-sm text-red-700">{error}</span>}

      {result && (
        <div className="w-full rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
          <p className="font-medium text-gray-800">
            {result.confirmed
              ? `✓ Importação concluída: ${result.created} empresa(s) cadastrada(s).`
              : `Pré-visualização: ${result.totalRows} linha(s) — ${result.validRows} válida(s), ${result.errorRows} com erro.`}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 max-h-40 list-inside list-disc space-y-0.5 overflow-y-auto text-xs text-red-700">
              {result.errors.map((e, i) => (
                <li key={i}>
                  Linha {e.line}: {e.error}
                </li>
              ))}
            </ul>
          )}
          {result.confirmed && (result.portalAccess?.length ?? 0) > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="font-semibold text-amber-900">
                🔑 Acessos ao portal criados automaticamente — anote as senhas AGORA (elas não
                aparecem de novo):
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-amber-800">
                      <th className="py-1 pr-4">Empresa</th>
                      <th className="py-1 pr-4">Login (e-mail)</th>
                      <th className="py-1">Senha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.portalAccess!.map((a, i) => (
                      <tr key={i} className="border-t border-amber-100">
                        <td className="py-1 pr-4">{a.empresa}</td>
                        <td className="py-1 pr-4">{a.email}</td>
                        <td className="py-1 font-mono">
                          {a.senha ?? <span className="text-amber-700">{a.obs ?? 'já tinha acesso — senha antiga vale'}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => {
                  const linhas = result.portalAccess!
                    .map((a) => `${a.empresa}\t${a.email}\t${a.senha ?? a.obs ?? 'senha existente'}`)
                    .join('\n');
                  void navigator.clipboard.writeText(`Empresa\tLogin\tSenha\n${linhas}`);
                }}
                className="mt-2 rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                📋 Copiar tudo
              </button>
            </div>
          )}
          {!result.confirmed && result.validRows > 0 && (
            <button
              onClick={() => send(true)}
              disabled={busy}
              className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Importando...' : `Confirmar importação de ${result.validRows} empresa(s)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
