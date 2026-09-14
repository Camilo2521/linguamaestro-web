import Link from 'next/link';
import { Brain, BookOpen, Mic } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TodayTask {
  id: string;
  type: 'srs' | 'lesson' | 'speaking';
  title: string;
  subtitle: string;
  href: string;
  count?: number;
  urgent?: boolean;
}

interface TodayPlanProps {
  srsCount: number;
  nextLesson?: { id: string; title: string; level: string } | null;
}

export function TodayPlan({ srsCount, nextLesson }: TodayPlanProps) {
  const tasks: TodayTask[] = [];

  if (srsCount > 0) {
    tasks.push({
      id: 'srs',
      type: 'srs',
      title: 'Repasar vocabulario',
      subtitle: `${srsCount} tarjeta${srsCount !== 1 ? 's' : ''} pendiente${srsCount !== 1 ? 's' : ''}`,
      href: '/learn/review',
      count: srsCount,
      urgent: srsCount > 30,
    });
  }

  if (nextLesson) {
    tasks.push({
      id: 'lesson',
      type: 'lesson',
      title: nextLesson.title,
      subtitle: `Lección ${nextLesson.level}`,
      href: `/learn/${nextLesson.id}`,
    });
  }

  tasks.push({
    id: 'speaking',
    type: 'speaking',
    title: 'Práctica oral',
    subtitle: 'Mejora tu pronunciación',
    href: '/practice',
  });

  const ICONS = { srs: Brain, lesson: BookOpen, speaking: Mic };
  const COLORS = {
    srs: 'text-violet-400 bg-violet-500/10',
    lesson: 'text-blue-400 bg-blue-500/10',
    speaking: 'text-emerald-400 bg-emerald-500/10',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plan de hoy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
            🎉 ¡Todo al día! Vuelve mañana.
          </p>
        ) : (
          tasks.map((task) => {
            const Icon = ICONS[task.type];
            return (
              <Link
                key={task.id}
                href={task.href}
                className="flex items-center gap-3 p-3 rounded-[var(--radius-lg)] hover:bg-[var(--color-bg-elevated)] transition-colors group"
              >
                <div className={`p-2 rounded-[var(--radius-md)] ${COLORS[task.type]}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{task.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{task.subtitle}</p>
                </div>
                {task.urgent && (
                  <Badge variant="warning" size="sm">Urgente</Badge>
                )}
                <svg className="h-4 w-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
