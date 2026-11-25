import { ESPRESSO_CATEGORIES, type EspressoCategory } from '@/lib/espresso';

interface Props {
  hidden: Set<EspressoCategory>;
  onToggle: (cat: EspressoCategory) => void;
}

/** "My calendars" (R-439): a checkbox per category; unticked ones are hidden from the grid. */
export function MyCalendarsPanel({ hidden, onToggle }: Props) {
  return (
    <section className="bg-card rounded-2xl shadow-card p-3.5">
      <h2 className="text-[15px] font-medium text-foreground mb-2">My calendars</h2>
      <div className="grid grid-cols-2 gap-x-2">
        {ESPRESSO_CATEGORIES.map(cat => (
          <label key={cat.id} className="flex items-center gap-1.5 min-h-[32px] text-[12px] text-foreground/90 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!hidden.has(cat.id)}
              onChange={() => onToggle(cat.id)}
              className="w-3.5 h-3.5 accent-[#59392D] shrink-0"
            />
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: cat.bg, boxShadow: cat.ring ? `inset 0 0 0 1px ${cat.ring}` : undefined }}
            />
            <span className="truncate">{cat.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
