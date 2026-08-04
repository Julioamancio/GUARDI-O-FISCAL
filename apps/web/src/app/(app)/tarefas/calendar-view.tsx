import Link from 'next/link';

interface TaskChip {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  company: { razaoSocial: string };
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const chipStyle = (status: string, late: boolean) => {
  if (status === 'CONCLUIDA') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'CANCELADA') return 'bg-gray-50 text-gray-400 border-gray-200 line-through';
  if (status === 'VENCIDA' || late) return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
};

/** Calendário mensal de vencimentos (req. 10). */
export function CalendarView({
  tasks,
  month,
  buildMonthLink,
}: {
  tasks: TaskChip[];
  month: string; // YYYY-MM
  buildMonthLink: (month: string) => string;
}) {
  const [year, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, monthNum - 1, 1)).getUTCDay();
  const today = new Date().toISOString().slice(0, 10);

  const shift = (delta: number) => {
    const total = year * 12 + (monthNum - 1) + delta;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  };

  const byDay = new Map<number, TaskChip[]>();
  for (const task of tasks) {
    const day = Number(task.dueDate.slice(8, 10));
    byDay.set(day, [...(byDay.get(day) ?? []), task]);
  }

  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href={buildMonthLink(shift(-1))}
          className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
          aria-label="Mês anterior"
        >
          ←
        </Link>
        <h2 className="font-semibold text-gray-800">
          {MONTHS[monthNum - 1]} de {year}
        </h2>
        <Link
          href={buildMonthLink(shift(1))}
          className="rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
          aria-label="Próximo mês"
        >
          →
        </Link>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-100 pb-1 text-center text-xs font-semibold uppercase text-gray-500">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          const iso = day ? `${month}-${String(day).padStart(2, '0')}` : '';
          const dayTasks = day ? (byDay.get(day) ?? []) : [];
          const isToday = iso === today;
          return (
            <div
              key={index}
              className={`min-h-24 border-b border-r border-gray-100 p-1 align-top ${
                day ? '' : 'bg-gray-50/50'
              } ${index % 7 === 0 ? 'border-l' : ''}`}
            >
              {day && (
                <>
                  <span
                    className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday ? 'bg-brand-600 text-white' : 'text-gray-600'
                    }`}
                  >
                    {day}
                  </span>
                  <div className="max-h-24 space-y-1 overflow-y-auto">
                    {dayTasks.map((task) => {
                      const late =
                        task.dueDate.slice(0, 10) < today &&
                        task.status !== 'CONCLUIDA' &&
                        task.status !== 'CANCELADA';
                      return (
                        <Link
                          key={task.id}
                          href={`/tarefas/${task.id}`}
                          title={`${task.title} — ${task.company.razaoSocial}`}
                          className={`block truncate rounded border px-1.5 py-0.5 text-[11px] leading-tight hover:opacity-80 ${chipStyle(task.status, late)}`}
                        >
                          {task.title}
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-blue-200 bg-blue-50" /> em aberto</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-red-200 bg-red-50" /> vencida</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm border border-green-200 bg-green-50" /> concluída</span>
      </p>
    </div>
  );
}
