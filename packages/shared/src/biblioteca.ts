/**
 * Taxonomia da Biblioteca de documentos por empresa.
 * O slug é gravado em Document.category (máx. 60 chars); "Declarações" tem
 * subcategorias baseadas no controle de obrigações acessórias 2026 do escritório
 * (fichas Simples Nacional, Lucro Presumido, Lucro Real e específicas).
 */
export interface BibliotecaItem {
  slug: string;
  label: string;
  icon?: string;
  children?: BibliotecaItem[];
}

export const BIBLIOTECA: BibliotecaItem[] = [
  { slug: 'documentos-base', label: 'Documentos Base', icon: '🗂️' },
  { slug: 'contratos', label: 'Contratos', icon: '📝' },
  { slug: 'alvaras', label: 'Alvarás', icon: '🏛️' },
  { slug: 'cartao-cnpj', label: 'Cartão CNPJ', icon: '🪪' },
  { slug: 'certificados-digitais', label: 'Certificados Digitais', icon: '🔐' },
  { slug: 'folha-pagamento', label: 'Folha de Pagamento', icon: '👥' },
  { slug: 'demonstracoes-financeiras', label: 'Demonstrações Financeiras', icon: '📊' },
  { slug: 'faturamento', label: 'Faturamento', icon: '💰' },
  {
    slug: 'declaracoes',
    label: 'Declarações',
    icon: '📋',
    children: [
      { slug: 'declaracoes/pgdas-d', label: 'PGDAS-D' },
      { slug: 'declaracoes/defis', label: 'DEFIS' },
      { slug: 'declaracoes/esocial', label: 'eSocial' },
      { slug: 'declaracoes/efd-reinf', label: 'EFD-Reinf' },
      { slug: 'declaracoes/dctfweb', label: 'DCTFWeb' },
      { slug: 'declaracoes/mit', label: 'MIT' },
      { slug: 'declaracoes/efd-contribuicoes', label: 'EFD-Contribuições' },
      { slug: 'declaracoes/efd-icms-ipi', label: 'EFD ICMS/IPI (SPED Fiscal)' },
      { slug: 'declaracoes/bloco-k', label: 'Bloco K' },
      { slug: 'declaracoes/destda', label: 'DeSTDA' },
      { slug: 'declaracoes/gia', label: 'GIA / Estadual' },
      { slug: 'declaracoes/iss-municipal', label: 'ISS / Municipal' },
      { slug: 'declaracoes/ecd', label: 'ECD' },
      { slug: 'declaracoes/ecf', label: 'ECF' },
      { slug: 'declaracoes/dirbi', label: 'DIRBI' },
      { slug: 'declaracoes/dere-ibs-cbs', label: 'DeRE (IBS/CBS)' },
      { slug: 'declaracoes/dimob', label: 'DIMOB' },
      { slug: 'declaracoes/dmed', label: 'DMED' },
      { slug: 'declaracoes/dme', label: 'DME' },
      { slug: 'declaracoes/bacen', label: 'Banco Central / Capitais' },
      { slug: 'declaracoes/outras', label: 'Outras declarações' },
    ],
  },
];

/** Rótulo legível de um slug de categoria (ex.: "declaracoes/pgdas-d" → "Declarações / PGDAS-D"). */
export function bibliotecaLabel(slug: string | null | undefined): string {
  if (!slug) return 'Sem categoria';
  for (const cat of BIBLIOTECA) {
    if (cat.slug === slug) return cat.label;
    const child = cat.children?.find((c) => c.slug === slug);
    if (child) return `${cat.label} / ${child.label}`;
  }
  return slug;
}

/** Segmentos de pasta (nomes legíveis) para o espelho em disco. */
export function bibliotecaFolderSegments(slug: string | null | undefined): string[] {
  if (!slug) return [];
  for (const cat of BIBLIOTECA) {
    if (cat.slug === slug) return [cat.label];
    const child = cat.children?.find((c) => c.slug === slug);
    if (child) return [cat.label, child.label];
  }
  return [slug];
}
