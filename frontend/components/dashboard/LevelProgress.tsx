import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLevelColor, getNextLevel, LEVELS } from '@/lib/utils/levels';
import type { CEFRLevel } from '@/types/domain.types';

interface LevelProgressProps {
  level: CEFRLevel;
  hoursStudied: number;
  examEligible?: boolean;
}

export function LevelProgress({ level, hoursStudied, examEligible }: LevelProgressProps) {
  const config = LEVELS[level];
  const nextLevel = getNextLevel(level);
  const pct = Math.min(100, Math.round((hoursStudied / config.min_hours) * 100));
  const color = getLevelColor(level);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Nivel actual</span>
          <Badge variant="level" level={level}>{level}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">{config.label}</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{config.description}</p>
          </div>
        </div>

        <Progress value={pct} color={color} size="sm" />

        <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
          <span>{Math.round(hoursStudied)}h completadas</span>
          <span>{config.min_hours}h requeridas</span>
        </div>

        {examEligible && (
          <div className="flex items-center gap-2 p-2.5 rounded-[var(--radius-lg)] bg-[var(--color-accent-gold)]/10 border border-[var(--color-accent-gold)]/30">
            <span className="text-base">🏆</span>
            <p className="text-xs font-medium text-[var(--color-accent-gold)]">
              Eres elegible para el examen de {level}
            </p>
          </div>
        )}

        {nextLevel && !examEligible && (
          <p className="text-xs text-[var(--color-text-muted)] text-center">
            {Math.max(0, config.min_hours - Math.round(hoursStudied))}h más para desbloquear el examen → {nextLevel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
