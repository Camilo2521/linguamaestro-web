'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ScoreRadar } from '@/components/exam/ScoreRadar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import type { DimensionScores, CEFRLevel } from '@/types/domain.types';
import { getLevelColor } from '@/lib/utils/levels';
import { examApi } from '@/lib/api/exam';

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  fluency: 'Fluidez', pronunciation: 'Pronunciación', grammar: 'Gramática',
  vocabulary: 'Vocabulario', coherence: 'Coherencia',
};

export default function ExamResultsPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [attempt, setAttempt] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    examApi.results(attemptId).then(
      (res) => {
        if (cancelled) return;
        if (!res.data.ai_feedback) {
          setNotFound(true);
          return;
        }
        setAttempt(res.data);
      },
      () => { if (!cancelled) setNotFound(true); },
    );
    return () => { cancelled = true; };
  }, [attemptId]);

  if (notFound) {
    return <p className="text-center py-12 text-[var(--color-text-muted)]">Resultado no encontrado.</p>;
  }

  if (!attempt) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-4">
        <Skeleton height={120} />
        <Skeleton height={200} />
      </div>
    );
  }

  const feedback = attempt.ai_feedback;
  const scores: DimensionScores = {
    fluency: feedback.fluency,
    pronunciation: feedback.pronunciation,
    grammar: feedback.grammar,
    vocabulary: feedback.vocabulary,
    coherence: feedback.coherence,
  };
  const overallPct = Math.round((feedback.overall_score ?? 0) * 100);
  const passed = feedback.passed ?? false;
  const level = attempt.enrollments?.current_level as CEFRLevel;

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      <div className="text-center space-y-3">
        <div className="text-5xl">{passed ? '🏆' : '📚'}</div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {passed ? '¡Examen aprobado!' : 'Continúa practicando'}
        </h1>
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl font-black text-[var(--color-text-primary)]">{overallPct}%</span>
          <Badge variant={passed ? 'success' : 'danger'} size="md">
            {passed ? 'Aprobado' : 'No aprobado'}
          </Badge>
        </div>
        {passed && (
          <p className="text-sm text-emerald-400 font-medium">
            ¡Has avanzado al siguiente nivel!
          </p>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Desglose por dimensión</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <ScoreRadar scores={scores} />
          {(Object.keys(DIMENSION_LABELS) as (keyof DimensionScores)[]).map((key) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-text-muted)] w-28 shrink-0">{DIMENSION_LABELS[key]}</span>
              <Progress value={Math.round((scores[key] ?? 0) * 100)} size="xs" className="flex-1" color={getLevelColor(level)} />
              <span className="text-xs font-bold text-[var(--color-text-primary)] w-8 text-right">
                {Math.round((scores[key] ?? 0) * 100)}%
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {feedback.strengths?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base text-emerald-400">Fortalezas</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {feedback.strengths.map((s: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                  <span className="text-emerald-400 shrink-0">✓</span>{s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {feedback.weaknesses?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base text-amber-400">Áreas de mejora</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {feedback.weaknesses.map((w: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                  <span className="text-amber-400 shrink-0">→</span>{w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {feedback.improvement_plan?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Plan de mejora (30 días)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {feedback.improvement_plan.slice(0, 4).map((task: any) => (
              <div key={task.week} className="flex gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--color-accent-primary)]/15 text-xs font-bold text-[var(--color-accent-primary)] shrink-0">
                  {task.week}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{task.task}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{task.estimated_minutes} min/sesión</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {attempt.transcript && (
        <Card>
          <CardHeader><CardTitle className="text-base">Transcripción</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed italic">
              "{attempt.transcript}"
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Link href="/exam" className="flex-1">
          <Button variant="secondary" className="w-full">Volver al examen</Button>
        </Link>
        <Link href="/dashboard" className="flex-1">
          <Button className="w-full">Ir al dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
