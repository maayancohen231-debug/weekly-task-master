import type { Task, TaskStatus } from '@/lib/task-types';

interface StatsCardProps {
  tasks: Task[];
  progress: number;
}

const STATUS_LABELS: { status: TaskStatus | 'total'; label: string; colorClass: string }[] = [
  { status: 'none', label: 'Active', colorClass: 'bg-muted-foreground/40' },
  { status: 'green', label: 'Done', colorClass: 'bg-[hsl(var(--status-green))]' },
  { status: 'yellow', label: 'In Progress', colorClass: 'bg-[hsl(var(--status-yellow))]' },
  { status: 'red', label: 'Delayed', colorClass: 'bg-[hsl(var(--status-red))]' },
  { status: 'total', label: 'Total', colorClass: 'bg-foreground/50' },
];

export function StatsCard({ tasks, progress }: StatsCardProps) {
  const circumference = 2 * Math.PI * 50;
  const counts: Record<string, number> = { none: 0, green: 0, yellow: 0, red: 0, total: tasks.length };
  tasks.forEach((t) => { counts[t.status] = (counts[t.status] ?? 0) + 1; });

  return (
    <div className="bg-card rounded-2xl shadow-card p-6">
      <div className="flex justify-center mb-5">
        <div className="relative w-[130px] h-[130px]">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="65" cy="65" r="50" stroke="hsl(var(--muted))" strokeWidth="10" fill="transparent" />
            <circle
              cx="65" cy="65" r="50"
              stroke="hsl(var(--status-green))"
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (circumference * progress) / 100}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold text-foreground">{progress}%</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {STATUS_LABELS.map(({ status, label, colorClass }) => (
          <div key={status} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
            <span className="text-sm font-bold text-foreground tabular-nums">{counts[status] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
