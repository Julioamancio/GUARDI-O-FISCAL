'use client';

import { useState } from 'react';

/** Botões de exportação: baixa o relatório via proxy autenticado (CSV/XLSX/PDF). */
export function ExportButtons({ path, filename }: { path: string; filename: string }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function download(format: 'csv' | 'xlsx' | 'pdf') {
    setBusy(format);
    try {
      const separator = path.includes('?') ? '&' : '?';
      const response = await fetch(`/api/proxy${path}${separator}format=${format}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message ?? `Erro ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500">Exportar:</span>
      {(['csv', 'xlsx', 'pdf'] as const).map((format) => (
        <button
          key={format}
          onClick={() => download(format)}
          disabled={busy !== null}
          className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold uppercase text-gray-700 hover:border-brand-500 hover:text-brand-700 disabled:opacity-50"
        >
          {busy === format ? '...' : format}
        </button>
      ))}
    </div>
  );
}
