/**
 * Motor de datas fiscais — casos validados contra o calendário civil real.
 * Fatos usados: Páscoa 2026 = 05/04; Carnaval 2026 = 16-17/02; Sexta Santa =
 * 03/04; Corpus Christi = 04/06; 20/09/2026 = domingo; 20/08/2026 = quinta.
 */
import {
  addDaysIso,
  computeDueDate,
  easterSunday,
  isBusinessDay,
  lastBusinessDay,
  nationalHolidays,
  nthBusinessDay,
  planTasks,
  taskKey,
} from '@guardiao/shared';

const holidays2026 = new Set(nationalHolidays(2026).map((h) => h.date));

describe('easterSunday', () => {
  it('calcula datas conhecidas da Páscoa', () => {
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2027)).toEqual({ month: 3, day: 28 });
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 });
  });
});

describe('nationalHolidays', () => {
  it('inclui fixos e móveis de 2026 nas datas corretas', () => {
    const dates = nationalHolidays(2026).map((h) => h.date);
    expect(dates).toContain('2026-02-16'); // Carnaval segunda
    expect(dates).toContain('2026-02-17'); // Carnaval terça
    expect(dates).toContain('2026-04-03'); // Sexta-feira Santa
    expect(dates).toContain('2026-06-04'); // Corpus Christi
    expect(dates).toContain('2026-11-20'); // Consciência Negra
    expect(dates).toContain('2026-12-25');
    expect(dates).toHaveLength(13);
  });
});

describe('isBusinessDay / nthBusinessDay / lastBusinessDay', () => {
  it('fim de semana e feriado não são dias úteis', () => {
    expect(isBusinessDay('2026-09-20', holidays2026)).toBe(false); // domingo
    expect(isBusinessDay('2026-04-21', holidays2026)).toBe(false); // Tiradentes (terça)
    expect(isBusinessDay('2026-08-20', holidays2026)).toBe(true); // quinta comum
  });

  it('10º dia útil de fevereiro/2026 é 13/02 (mês começa em domingo)', () => {
    expect(nthBusinessDay(2026, 2, 10, holidays2026)).toBe('2026-02-13');
  });

  it('último dia útil considera fim de semana', () => {
    // 31/05/2026 é domingo; 30/05 sábado -> 29/05 sexta
    expect(lastBusinessDay(2026, 5, holidays2026)).toBe('2026-05-29');
  });
});

describe('computeDueDate', () => {
  it('DAS: dia 20 do mês seguinte, POSTPONE — competência 07/2026 vence 20/08 (quinta)', () => {
    const rule = { day: 20 as const, monthOffset: 1, adjustment: 'POSTPONE' as const };
    expect(computeDueDate(2026, 7, rule, holidays2026)).toBe('2026-08-20');
  });

  it('DAS: competência 08/2026 cai em domingo (20/09) e prorroga para 21/09', () => {
    const rule = { day: 20 as const, monthOffset: 1, adjustment: 'POSTPONE' as const };
    expect(computeDueDate(2026, 8, rule, holidays2026)).toBe('2026-09-21');
  });

  it('FGTS: mesma data-base mas ANTECIPA — competência 08/2026 vence 18/09 (sexta)', () => {
    const rule = { day: 20 as const, monthOffset: 1, adjustment: 'ANTICIPATE' as const };
    expect(computeDueDate(2026, 8, rule, holidays2026)).toBe('2026-09-18');
  });

  it('vencimento em feriado (Tiradentes, terça 21/04) posterga para 22/04', () => {
    const rule = { day: 21 as const, monthOffset: 1, adjustment: 'POSTPONE' as const };
    expect(computeDueDate(2026, 3, rule, holidays2026)).toBe('2026-04-22');
  });

  it('EFD-Contribuições: 10º dia útil do 2º mês após a competência', () => {
    const rule = { businessDay: 10, monthOffset: 2, adjustment: 'NONE' as const };
    expect(computeDueDate(2025, 12, rule, holidays2026)).toBe('2026-02-13');
  });

  it('LAST_DAY respeita meses curtos e ano-limite de dezembro', () => {
    const rule = { day: 'LAST_DAY' as const, monthOffset: 0, adjustment: 'NONE' as const };
    expect(computeDueDate(2026, 2, rule, holidays2026)).toBe('2026-02-28');
    const rollover = { day: 20 as const, monthOffset: 1, adjustment: 'NONE' as const };
    expect(computeDueDate(2026, 12, rollover, new Set())).toBe('2027-01-20');
  });

  it('ANTICIPATE atravessa Carnaval: vencimento 17/02/2026 antecipa até 13/02 (sexta)', () => {
    // 17/02 = Carnaval; 16/02 = Carnaval; 15/02 domingo; 14/02 sábado -> 13/02
    const rule = { day: 17 as const, monthOffset: 0, adjustment: 'ANTICIPATE' as const };
    expect(computeDueDate(2026, 2, rule, holidays2026)).toBe('2026-02-13');
  });
});

describe('planTasks', () => {
  const baseObligation = {
    id: 'ob-1',
    tenantId: 't-1',
    companyId: 'c-1',
    name: 'DAS — Simples Nacional',
    department: 'FISCAL',
    priority: 'ALTA',
    checklist: [],
    periodicity: 'MENSAL' as const,
    anchorMonth: 1,
    dueRule: { day: 20, monthOffset: 1, adjustment: 'POSTPONE' as const },
    responsibleId: null,
  };

  it('gera competências com vencimento dentro da janela e títulos com MM/AAAA', () => {
    const planned = planTasks([baseObligation], new Set(), holidays2026, '2026-08-04');
    const competences = planned.map((p) => p.competence);
    expect(competences).toContain('2026-07'); // vence 20/08
    expect(competences).toContain('2026-08'); // vence 21/09
    expect(competences).not.toContain('2026-01'); // vencimento muito antigo
    const aug = planned.find((p) => p.competence === '2026-08');
    expect(aug?.dueDate).toBe('2026-09-21');
    expect(aug?.title).toBe('DAS — Simples Nacional — 08/2026');
  });

  it('é idempotente: competência já existente não é replanejada', () => {
    const first = planTasks([baseObligation], new Set(), holidays2026, '2026-08-04');
    const keys = new Set(first.map((p) => taskKey(p.obligationId, p.competence)));
    expect(planTasks([baseObligation], keys, holidays2026, '2026-08-04')).toHaveLength(0);
  });

  it('TRIMESTRAL com anchorMonth 1 só gera jan/abr/jul/out', () => {
    const quarterly = { ...baseObligation, id: 'ob-2', periodicity: 'TRIMESTRAL' as const };
    const planned = planTasks([quarterly], new Set(), holidays2026, '2026-08-04', 90, 60);
    for (const p of planned) {
      expect([1, 4, 7, 10]).toContain(Number(p.competence.split('-')[1]));
    }
    expect(planned.length).toBeGreaterThan(0);
  });

  it('janela: nada é gerado se todos os vencimentos estiverem longe', () => {
    const annual = {
      ...baseObligation,
      id: 'ob-3',
      periodicity: 'ANUAL' as const,
      anchorMonth: 12,
      dueRule: { day: 31, monthOffset: 3, adjustment: 'NONE' as const }, // vence 31/03
    };
    // Em agosto, o vencimento de março já passou (fora do lookBehind) e o próximo está a 8 meses
    expect(planTasks([annual], new Set(), holidays2026, '2026-08-04')).toHaveLength(0);
  });

  it('addDaysIso atravessa meses e anos corretamente', () => {
    expect(addDaysIso('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysIso('2026-02-28', 1)).toBe('2026-03-01');
  });
});
