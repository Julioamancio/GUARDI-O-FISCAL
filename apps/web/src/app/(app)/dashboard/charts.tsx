import Link from 'next/link';

/**
 * Componentes de visualização (server-rendered, sem dependência externa).
 * Paleta: instância de referência validada (dataviz) — status fixos
 * (good/warning/serious/critical) e categóricas na ordem segura para
 * daltonismo. Todo número é texto (tinta), nunca só cor; tudo clicável.
 */

export const VIZ = {
  // status (fixos, nunca reutilizados como série)
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
  // categóricas (ordem fixa validada)
  s1: '#2a78d6', // azul
  s2: '#eb6834', // laranja
  s3: '#1baf7a', // aqua
  s4: '#eda100', // amarelo
  s5: '#e87ba4', // magenta
  // tinta/superfície
  muted: '#898781',
  grid: '#e1e0d9',
  neutral: '#c3c2b7',
} as const;

export interface Segment {
  label: string;
  value: number;
  color: string;
  href?: string;
}

/** Donut SVG com número-herói no centro e legenda com contagens. */
export function Donut({
  segments,
  centerValue,
  centerLabel,
  size = 168,
}: {
  segments: Segment[];
  centerValue: string;
  centerLabel: string;
  size?: number;
}) {
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  const radius = size / 2 - 12;
  const stroke = 22;
  const circumference = 2 * Math.PI * radius;
  const gap = visible.length > 1 ? 2 : 0; // espaçador de 2px entre fatias

  let offset = -circumference / 4; // começa no topo
  const arcs = visible.map((segment) => {
    const length = total > 0 ? (segment.value / total) * circumference : 0;
    const arc = { ...segment, dash: Math.max(length - gap, 0.5), offset };
    offset += length;
    return arc;
  });

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} role="img" aria-label={`${centerLabel}: ${centerValue}`}>
        {total === 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={VIZ.grid}
            strokeWidth={stroke}
          />
        )}
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={stroke}
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="butt"
          >
            <title>{`${arc.label}: ${arc.value}`}</title>
          </circle>
        ))}
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          className="fill-gray-900"
          style={{ fontSize: 30, fontWeight: 700 }}
        >
          {centerValue}
        </text>
        <text x="50%" y="60%" textAnchor="middle" style={{ fontSize: 11, fill: VIZ.muted }}>
          {centerLabel}
        </text>
      </svg>
      <ul className="space-y-1.5 text-sm">
        {segments.map((segment) => (
          <li key={segment.label}>
            <Link
              href={segment.href ?? '#'}
              className="group flex items-center gap-2 text-gray-700 hover:text-brand-700"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: segment.value > 0 ? segment.color : VIZ.grid }}
              />
              <span className="group-hover:underline">{segment.label}</span>
              <span className="font-semibold tabular-nums text-gray-900">{segment.value}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontais finas com ponta arredondada e rótulo direto. */
export function HBars({ items }: { items: Segment[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <Link href={item.href ?? '#'} className="group block">
            <div className="mb-0.5 flex items-baseline justify-between text-sm">
              <span className="text-gray-600 group-hover:text-brand-700 group-hover:underline">
                {item.label}
              </span>
              <span className="font-semibold tabular-nums text-gray-900">{item.value}</span>
            </div>
            <div className="h-2.5 w-full rounded-full" style={{ backgroundColor: '#f0efec' }}>
              <div
                className="h-2.5 rounded-full transition-all"
                style={{
                  width: `${Math.max((item.value / max) * 100, item.value > 0 ? 3 : 0)}%`,
                  backgroundColor: item.color,
                }}
                title={`${item.label}: ${item.value}`}
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export interface StackGroup {
  label: string;
  href?: string;
  parts: Array<{ label: string; value: number; color: string }>;
}

/** Colunas empilhadas com espaçador de 2px, total no topo e legenda. */
export function StackedColumns({ groups, height = 140 }: { groups: StackGroup[]; height?: number }) {
  const max = Math.max(1, ...groups.map((g) => g.parts.reduce((a, p) => a + p.value, 0)));
  const legend = groups[0]?.parts.map((p) => ({ label: p.label, color: p.color })) ?? [];

  return (
    <div>
      <div className="flex items-end justify-between gap-2" style={{ height: height + 34 }}>
        {groups.map((group) => {
          const total = group.parts.reduce((a, p) => a + p.value, 0);
          return (
            <Link
              key={group.label}
              href={group.href ?? '#'}
              className="group flex h-full flex-1 flex-col items-center justify-end"
              title={group.parts.map((p) => `${p.label}: ${p.value}`).join(' · ')}
            >
              <span className="mb-1 text-xs font-semibold tabular-nums text-gray-700">
                {total > 0 ? total : ''}
              </span>
              <div className="flex w-full max-w-10 flex-col-reverse gap-0.5">
                {group.parts.map(
                  (part) =>
                    part.value > 0 && (
                      <div
                        key={part.label}
                        className="w-full first:rounded-b-[4px] last:rounded-t-[4px]"
                        style={{
                          height: Math.max((part.value / max) * height, 3),
                          backgroundColor: part.color,
                        }}
                      />
                    ),
                )}
                {total === 0 && (
                  <div className="h-[3px] w-full rounded-full" style={{ backgroundColor: VIZ.grid }} />
                )}
              </div>
              <span className="mt-1.5 text-[11px] text-gray-500 group-hover:text-brand-700">
                {group.label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 border-t pt-2" style={{ borderColor: VIZ.grid }}>
        {legend.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Cartão-moldura padrão dos gráficos. */
export function ChartCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-gray-800">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
