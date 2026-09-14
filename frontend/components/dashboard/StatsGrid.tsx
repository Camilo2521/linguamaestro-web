import { Flame, Clock, Brain, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { EnrollmentStats } from '@/types/domain.types';

interface StatsGridProps {
  stats: EnrollmentStats;
  streak: number;
}

export function StatsGrid({ stats, streak }: StatsGridProps) {
  const items = [
    {
      icon: Flame,
      label: 'Racha actual',
      value: `${streak}`,
      unit: 'días',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
    },
    {
      icon: Clock,
      label: 'Horas totales',
      value: Math.round(stats.total_study_hours).toString(),
      unit: 'h',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      icon: Brain,
      label: 'Palabras SRS',
      value: stats.srs_cards_due.toString(),
      unit: 'pendientes',
      color: 'text-violet-400',
      bg: 'bg-violet-500/10',
    },
    {
      icon: Trophy,
      label: 'Lecciones',
      value: stats.lessons_completed.toString(),
      unit: 'completadas',
      color: 'text-[var(--color-accent-gold)]',
      bg: 'bg-[var(--color-accent-gold)]/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ icon: Icon, label, value, unit, color, bg }) => (
        <Card key={label} className="p-4">
          <div className={`inline-flex p-2 rounded-[var(--radius-lg)] ${bg} mb-3`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mb-0.5">{label}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{unit}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
