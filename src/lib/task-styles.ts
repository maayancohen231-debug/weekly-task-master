import type { TaskStatus, TaskColor } from './task-types';

export const statusClasses: Record<TaskStatus, string> = {
  none: 'bg-card',
  green: 'bg-[hsl(var(--status-green-bg))]',
  yellow: 'bg-[hsl(var(--status-yellow-bg))]',
  red: 'bg-[hsl(var(--status-red-bg))]',
};

export const statusBorderClasses: Record<TaskStatus, string> = {
  none: 'border-border/60',
  green: 'border-[hsl(var(--status-green)/0.2)]',
  yellow: 'border-[hsl(var(--status-yellow)/0.2)]',
  red: 'border-[hsl(var(--status-red)/0.2)]',
};

export const statusIconClasses: Record<TaskStatus, string> = {
  none: 'text-muted-foreground/25',
  green: 'text-[hsl(var(--status-green))]',
  yellow: 'text-[hsl(var(--status-yellow))]',
  red: 'text-[hsl(var(--status-red))]',
};

export const colorDotClasses: Record<TaskColor, string> = {
  none: '',
  blue: 'bg-[hsl(var(--task-blue))]',
  purple: 'bg-[hsl(var(--task-purple))]',
  orange: 'bg-[hsl(var(--task-orange))]',
  pink: 'bg-[hsl(var(--task-pink))]',
  teal: 'bg-[hsl(var(--task-teal))]',
  red: 'bg-[hsl(var(--task-red))]',
  amber: 'bg-[hsl(var(--task-amber))]',
  green: 'bg-[hsl(var(--task-green))]',
  indigo: 'bg-[hsl(var(--task-indigo))]',
  rose: 'bg-[hsl(var(--task-rose))]',
};

export const colorBorderOverrides: Record<TaskColor, string> = {
  none: '',
  blue: 'border-l-[hsl(var(--task-blue))] border-l-[3px]',
  purple: 'border-l-[hsl(var(--task-purple))] border-l-[3px]',
  orange: 'border-l-[hsl(var(--task-orange))] border-l-[3px]',
  pink: 'border-l-[hsl(var(--task-pink))] border-l-[3px]',
  teal: 'border-l-[hsl(var(--task-teal))] border-l-[3px]',
  red: 'border-l-[hsl(var(--task-red))] border-l-[3px]',
  amber: 'border-l-[hsl(var(--task-amber))] border-l-[3px]',
  green: 'border-l-[hsl(var(--task-green))] border-l-[3px]',
  indigo: 'border-l-[hsl(var(--task-indigo))] border-l-[3px]',
  rose: 'border-l-[hsl(var(--task-rose))] border-l-[3px]',
};

export const colorBgTint: Record<TaskColor, string> = {
  none: '',
  blue: 'bg-[hsl(var(--task-blue)/0.12)]',
  purple: 'bg-[hsl(var(--task-purple)/0.12)]',
  orange: 'bg-[hsl(var(--task-orange)/0.12)]',
  pink: 'bg-[hsl(var(--task-pink)/0.12)]',
  teal: 'bg-[hsl(var(--task-teal)/0.12)]',
  red: 'bg-[hsl(var(--task-red)/0.12)]',
  amber: 'bg-[hsl(var(--task-amber)/0.12)]',
  green: 'bg-[hsl(var(--task-green)/0.12)]',
  indigo: 'bg-[hsl(var(--task-indigo)/0.12)]',
  rose: 'bg-[hsl(var(--task-rose)/0.12)]',
};
