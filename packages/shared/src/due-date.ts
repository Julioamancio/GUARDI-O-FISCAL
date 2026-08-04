/**
 * Motor de datas fiscais: dias úteis, feriados (fixos e móveis) e regras de
 * vencimento de obrigações. Funções puras — sem banco, sem timezone do SO:
 * toda data é tratada como string ISO (YYYY-MM-DD) em calendário civil.
 */

export interface DueRule {
  /** Dia fixo do mês, último dia ou último dia útil. Ignorado se businessDay presente. */
  day?: number | 'LAST_DAY' | 'LAST_BUSINESS_DAY';
  /** N-ésimo dia útil do mês (ex.: EFD-Contribuições = 10º dia útil). */
  businessDay?: number;
  /** Meses após a competência (DAS da competência 07 vence em 08 => 1). */
  monthOffset: number;
  /** O que fazer quando cai em dia não útil. */
  adjustment: 'NONE' | 'ANTICIPATE' | 'POSTPONE';
}

export interface HolidayInput {
  date: string; // YYYY-MM-DD
  name: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return toIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=dom ... 6=sáb
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/** Feriados nacionais do ano (fixos + móveis derivados da Páscoa). */
export function nationalHolidays(year: number): HolidayInput[] {
  const fixed: HolidayInput[] = [
    { date: toIso(year, 1, 1), name: 'Confraternização Universal' },
    { date: toIso(year, 4, 21), name: 'Tiradentes' },
    { date: toIso(year, 5, 1), name: 'Dia do Trabalho' },
    { date: toIso(year, 9, 7), name: 'Independência do Brasil' },
    { date: toIso(year, 10, 12), name: 'Nossa Senhora Aparecida' },
    { date: toIso(year, 11, 2), name: 'Finados' },
    { date: toIso(year, 11, 15), name: 'Proclamação da República' },
    { date: toIso(year, 11, 20), name: 'Dia Nacional de Zumbi e da Consciência Negra' },
    { date: toIso(year, 12, 25), name: 'Natal' },
  ];
  const easter = toIso(year, easterSunday(year).month, easterSunday(year).day);
  const movable: HolidayInput[] = [
    { date: addDaysIso(easter, -48), name: 'Carnaval (segunda-feira)' },
    { date: addDaysIso(easter, -47), name: 'Carnaval (terça-feira)' },
    { date: addDaysIso(easter, -2), name: 'Sexta-feira Santa' },
    { date: addDaysIso(easter, 60), name: 'Corpus Christi' },
  ];
  return [...fixed, ...movable].sort((x, y) => x.date.localeCompare(y.date));
}

export function isBusinessDay(iso: string, holidays: ReadonlySet<string>): boolean {
  const weekday = weekdayOf(iso);
  return weekday !== 0 && weekday !== 6 && !holidays.has(iso);
}

export function adjustToBusinessDay(
  iso: string,
  direction: 'ANTICIPATE' | 'POSTPONE',
  holidays: ReadonlySet<string>,
): string {
  let current = iso;
  const step = direction === 'ANTICIPATE' ? -1 : 1;
  while (!isBusinessDay(current, holidays)) {
    current = addDaysIso(current, step);
  }
  return current;
}

export function lastBusinessDay(year: number, month: number, holidays: ReadonlySet<string>): string {
  return adjustToBusinessDay(toIso(year, month, daysInMonth(year, month)), 'ANTICIPATE', holidays);
}

export function nthBusinessDay(
  year: number,
  month: number,
  n: number,
  holidays: ReadonlySet<string>,
): string {
  let count = 0;
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    const iso = toIso(year, month, d);
    if (isBusinessDay(iso, holidays)) {
      count++;
      if (count === n) return iso;
    }
  }
  // Mês sem N dias úteis não existe na prática; falha explícita é melhor que data errada.
  throw new Error(`Mês ${year}-${pad(month)} não possui ${n} dias úteis`);
}

/**
 * Calcula o vencimento de uma obrigação para uma competência (ano/mês).
 * Regra validável: ver testes em apps/api/src/obligations/due-date.spec.ts.
 */
export function computeDueDate(
  compYear: number,
  compMonth: number,
  rule: DueRule,
  holidays: ReadonlySet<string>,
): string {
  const totalMonths = compYear * 12 + (compMonth - 1) + rule.monthOffset;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;

  if (rule.businessDay !== undefined) {
    return nthBusinessDay(year, month, rule.businessDay, holidays);
  }

  let iso: string;
  if (rule.day === 'LAST_BUSINESS_DAY') {
    return lastBusinessDay(year, month, holidays);
  } else if (rule.day === 'LAST_DAY') {
    iso = toIso(year, month, daysInMonth(year, month));
  } else if (typeof rule.day === 'number') {
    iso = toIso(year, month, Math.min(rule.day, daysInMonth(year, month)));
  } else {
    throw new Error('DueRule inválida: informe day ou businessDay');
  }

  if (rule.adjustment === 'NONE' || isBusinessDay(iso, holidays)) {
    return iso;
  }
  return adjustToBusinessDay(iso, rule.adjustment, holidays);
}

// ---------------------------------------------------------------------------
// Planejador de tarefas recorrentes (puro: API e worker compartilham a lógica)
// ---------------------------------------------------------------------------

export interface ObligationForPlanning {
  id: string;
  tenantId: string;
  companyId: string;
  name: string;
  department: string;
  priority: string;
  checklist: unknown;
  periodicity: 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL';
  anchorMonth: number;
  dueRule: DueRule;
  responsibleId: string | null;
}

export interface PlannedTask {
  tenantId: string;
  companyId: string;
  obligationId: string;
  title: string;
  department: string;
  competence: string; // YYYY-MM
  dueDate: string; // YYYY-MM-DD
  priority: string;
  checklist: unknown;
  responsibleId: string | null;
}

export const taskKey = (obligationId: string, competence: string) =>
  `${obligationId}:${competence}`;

function competenceMatches(periodicity: string, anchorMonth: number, month: number): boolean {
  const interval = { MENSAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 }[periodicity];
  if (!interval) return false;
  return (((month - anchorMonth) % interval) + interval) % interval === 0;
}

/**
 * Gera as tarefas que deveriam existir e ainda não existem.
 * Janela: vencimentos entre (hoje - lookBehindDays) e (hoje + lookAheadDays).
 * Idempotente por construção: quem chama filtra por existingKeys e o banco
 * garante UNIQUE (obligationId, competence).
 */
export function planTasks(
  obligations: ObligationForPlanning[],
  existingKeys: ReadonlySet<string>,
  holidays: ReadonlySet<string>,
  todayIso: string,
  lookAheadDays = 60,
  lookBehindDays = 45,
): PlannedTask[] {
  const [todayYear, todayMonth] = todayIso.split('-').map(Number);
  const windowStart = addDaysIso(todayIso, -lookBehindDays);
  const windowEnd = addDaysIso(todayIso, lookAheadDays);
  const planned: PlannedTask[] = [];

  for (const obligation of obligations) {
    // Competências candidatas: dos 6 meses anteriores até 4 à frente
    for (let offset = -6; offset <= 4; offset++) {
      const total = todayYear * 12 + (todayMonth - 1) + offset;
      const year = Math.floor(total / 12);
      const month = (total % 12) + 1;
      if (!competenceMatches(obligation.periodicity, obligation.anchorMonth, month)) continue;

      const competence = `${year}-${pad(month)}`;
      if (existingKeys.has(taskKey(obligation.id, competence))) continue;

      const dueDate = computeDueDate(year, month, obligation.dueRule, holidays);
      if (dueDate < windowStart || dueDate > windowEnd) continue;

      planned.push({
        tenantId: obligation.tenantId,
        companyId: obligation.companyId,
        obligationId: obligation.id,
        title: `${obligation.name} — ${pad(month)}/${year}`,
        department: obligation.department,
        competence,
        dueDate,
        priority: obligation.priority,
        checklist: obligation.checklist ?? [],
        responsibleId: obligation.responsibleId,
      });
    }
  }
  return planned;
}
