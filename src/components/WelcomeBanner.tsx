import { useEffect, useState } from 'react';
import { ListChecks, CalendarDays, ChartGantt } from 'lucide-react';

/** Short lines for the banner; one per day, so it doesn't jump around. */
const QUOTES = [
  'Small steps every day add up to big results.',
  'Focus on what matters, let go of the rest.',
  'Done is better than perfect.',
  'One thing at a time, and that one thing well.',
  'Plan the week, then trust the plan.',
  'Rest is part of the work.',
  'Progress, not perfection.',
];

function dayOfYear(d: Date): number {
  return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
}

interface Props {
  name: string;
  onTasks: () => void;
  onCalendar: () => void;
  onProgress: () => void;
}

/**
 * Espresso "Welcome back" strip (R-439). Kept compact on purpose (~100px):
 * one line of greeting, time and quote, one line of shortcut pills.
 * Contacts is left out until there is a contacts screen (her answer, 20.11).
 */
export function WelcomeBanner({ name, onTasks, onCalendar, onProgress }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const quote = QUOTES[dayOfYear(now) % QUOTES.length];

  const pills = [
    { label: 'Tasks', icon: ListChecks, onClick: onTasks },
    { label: 'Calendar', icon: CalendarDays, onClick: onCalendar },
    { label: 'Progress', icon: ChartGantt, onClick: onProgress },
  ];

  return (
    <section className="espresso-banner rounded-[18px] px-5 py-2.5 flex flex-col gap-2 text-[#2B1D17]" aria-label="Welcome">
      <div className="flex items-baseline gap-4 min-w-0">
        <p className="flex items-baseline gap-1.5 shrink-0">
          <span className="italic text-[14px]" style={{ fontFamily: 'Georgia, serif' }}>Welcome back,</span>
          <span className="text-[20px] font-bold leading-none">{name}</span>
        </p>
        <p className="flex items-baseline gap-1.5 shrink-0">
          <span className="text-[16px] font-bold tabular-nums">{time}</span>
          <span className="text-[13px] opacity-80">{weekday}</span>
        </p>
        <p className="ml-auto max-w-[300px] italic text-[12px] leading-snug opacity-80 line-clamp-2 hidden md:block" style={{ fontFamily: 'Georgia, serif' }}>
          “{quote}”
        </p>
      </div>
      <nav className="flex items-center gap-2" aria-label="Shortcuts">
        {pills.map(({ label, icon: Icon, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="relative flex items-center gap-2 h-9 pl-1 pr-3 rounded-[14px] bg-white/55 hover:bg-white/75 text-[13px] font-medium transition-base before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']"
          >
            <span className="flex items-center justify-center w-[26px] h-[26px] rounded-lg bg-[#3A241C] text-white">
              <Icon size={15} />
            </span>
            {label}
          </button>
        ))}
      </nav>
    </section>
  );
}
