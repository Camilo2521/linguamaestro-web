'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getLevelColor } from '@/lib/utils/levels';
import { CheckCircle, Lock, Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { lessonsApi } from '@/lib/api/lessons';
import { authApi } from '@/lib/api/auth';
import { Skeleton } from '@/components/ui/skeleton';

export default function LearnPage() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the enrollment fresh rather than trusting the Zustand store —
    // on a direct load/refresh the store hasn't been populated by
    // AuthProvider yet, so reading it synchronously during render would
    // bounce a fully-onboarded user back to onboarding every time.
    let cancelled = false;
    authApi.me().then(async ({ data }) => {
      if (cancelled) return;
      const active = data.enrollments[0];
      if (!active) {
        router.replace('/onboarding/language');
        return;
      }
      setEnrollment(active);
      const res = await lessonsApi.list(active.id);
      if (cancelled) return;
      setLessons(res.data.lessons);
      setProgressMap(new Map(res.data.progress.map((p: any) => [p.lesson_id, p])));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [router]);

  if (loading || !enrollment) {
    return (
      <div className="space-y-6">
        <Skeleton height={40} />
        <Skeleton height={80} />
      </div>
    );
  }

  const completedCount = [...progressMap.values()].filter((p) => p.completed).length;
  const totalCount = lessons.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Lecciones</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Nivel {enrollment.current_level} · {completedCount}/{totalCount} completadas
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Progress value={pct} size="md" animated color={getLevelColor(enrollment.current_level)} className="flex-1" />
        <span className="text-sm font-semibold text-[var(--color-text-primary)] shrink-0">{pct}%</span>
      </div>

      <Link
        href="/learn/review"
        className="flex items-center gap-3 p-4 rounded-[var(--radius-xl)] bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/15 transition-colors"
      >
        <div className="p-2 rounded-[var(--radius-lg)] bg-violet-500/20">
          <RotateCcw className="h-4 w-4 text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Repasar vocabulario (SRS)</p>
          <p className="text-xs text-[var(--color-text-muted)]">Repetición espaciada con FSRS v5</p>
        </div>
        <svg className="h-4 w-4 text-violet-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      <div className="space-y-3">
        {lessons.map((lesson: any, i: number) => {
          const prog = progressMap.get(lesson.id);
          const completed = prog?.completed ?? false;
          const prevCompleted = i === 0 || progressMap.get(lessons[i - 1]?.id)?.completed;
          const locked = !prevCompleted && !completed && i > 0;
          const score = prog?.score ? Math.round(prog.score * 100) : null;

          return (
            <div key={lesson.id}>
              {locked ? (
                <Card className={cn('opacity-50 cursor-not-allowed')}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-bg-overlay)] shrink-0">
                      <Lock className="h-4 w-4 text-[var(--color-text-muted)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{lesson.title}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">Completa la lección anterior primero</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Link href={`/learn/${lesson.id}`}>
                  <Card hover>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className={cn(
                        'flex items-center justify-center w-10 h-10 rounded-full shrink-0',
                        completed ? 'bg-emerald-500/15' : 'bg-[var(--color-accent-primary)]/10',
                      )}>
                        {completed
                          ? <CheckCircle className="h-5 w-5 text-emerald-400" />
                          : <Play className="h-4 w-4 text-[var(--color-accent-primary)]" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{lesson.title}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {lesson.exercise_count ?? 5} ejercicios · {lesson.estimated_minutes ?? 10} min
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {score !== null && (
                          <span className="text-xs font-semibold text-emerald-400">{score}%</span>
                        )}
                        <svg className="h-4 w-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )}
            </div>
          );
        })}

        {lessons.length === 0 && (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            <p className="text-4xl mb-3">📚</p>
            <p className="text-sm">No hay lecciones disponibles para este nivel aún.</p>
          </div>
        )}
      </div>
    </div>
  );
}
