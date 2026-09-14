'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface StreakCalendarProps {
  currentStreak: number;
  longestStreak: number;
  activeDates?: string[];
}

export function StreakCalendar({ currentStreak, longestStreak, activeDates = [] }: StreakCalendarProps) {
  const activeSet = useMemo(() => new Set(activeDates), [activeDates]);

  const weeks = useMemo(() => {
    const today = new Date();
    const cells: { date: string; isToday: boolean; isActive: boolean }[] = [];

    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      cells.push({ date: iso, isToday: i === 0, isActive: activeSet.has(iso) });
    }

    const grid: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      grid.push(cells.slice(i, i + 7));
    }
    return grid;
  }, [activeSet]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-400" />
            Racha de estudio
          </span>
          <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
            <span>Actual: <strong className="text-orange-400">{currentStreak}d</strong></span>
            <span>Máx: <strong className="text-[var(--color-text-primary)]">{longestStreak}d</strong></span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day) => (
                <div
                  key={day.date}
                  title={day.date}
                  className={cn(
                    'w-3 h-3 rounded-sm transition-all',
                    day.isActive && 'bg-[var(--color-accent-primary)]',
                    !day.isActive && 'bg-[var(--color-bg-overlay)]',
                    day.isToday && 'ring-1 ring-[var(--color-accent-primary)] ring-offset-1 ring-offset-[var(--color-bg-card)]',
                  )}
                />
              ))}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-2">Últimos 90 días</p>
      </CardContent>
    </Card>
  );
}
