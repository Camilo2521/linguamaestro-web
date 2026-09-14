'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { examApi } from '@/lib/api/exam';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { getLevelColor, LEVELS } from '@/lib/utils/levels';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import type { CEFRLevel, ExamEligibility } from '@/types/domain.types';

export default function ExamPage() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<any>(null);
  const [eligibility, setEligibility] = useState<ExamEligibility | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    examApi.overview().then(
      async (res) => {
        if (cancelled) return;
        setEnrollment(res.data);
        const elig = await examApi.eligibility(res.data.id);
        if (cancelled) return;
        setEligibility(elig.data);
        setLoading(false);
      },
      () => {
        if (!cancelled) router.replace('/onboarding/language');
      },
    );
    return () => { cancelled = true; };
  }, [router]);

  if (loading || !enrollment) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Skeleton height={40} />
        <Skeleton height={160} />
      </div>
    );
  }

  const currentLevel = enrollment.current_level as CEFRLevel;
  const levelConfig = LEVELS[currentLevel];
  const hoursProgress = Math.min(100, ((enrollment.total_study_hours ?? 0) / levelConfig.min_hours) * 100);
  const lastAttempt = (enrollment.exam_attempts ?? [])[0];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Examen CEFR</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Certifica tu nivel y avanza al siguiente
        </p>
      </div>

      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Nivel actual</span>
            <Badge variant="level" level={currentLevel}>{currentLevel} — {levelConfig.label}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
              <span>Horas de estudio</span>
              <span>{Math.round(enrollment.total_study_hours ?? 0)}h / {levelConfig.min_hours}h</span>
            </div>
            <Progress value={hoursProgress} color={getLevelColor(enrollment.current_level)} size="md" animated />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2">
            {[
              { label: 'Duración del examen', value: `${levelConfig.exam_duration_minutes} min` },
              { label: 'Puntuación mínima', value: `${Math.round(levelConfig.min_score_to_pass * 100)}%` },
              { label: 'Dimensiones evaluadas', value: '5 áreas' },
              { label: 'Evaluación por', value: 'IA (Claude)' },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-[var(--radius-lg)] bg-[var(--color-bg-elevated)]">
                <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {eligibility && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {eligibility.eligible
                ? <><CheckCircle className="h-4 w-4 text-emerald-400" /> Elegible para el examen</>
                : <><AlertTriangle className="h-4 w-4 text-amber-400" /> Requisitos pendientes</>
              }
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {eligibility.eligible ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                Cumples todos los requisitos. ¡Estás listo para el examen!
              </p>
            ) : (
              <ul className="space-y-1.5">
                {eligibility.reasons.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                    <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {lastAttempt && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
              Último intento
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {new Date(lastAttempt.created_at).toLocaleDateString('es-ES')}
              </p>
              {lastAttempt.overall_score != null && (
                <p className="text-lg font-bold text-[var(--color-text-primary)]">
                  {Math.round(lastAttempt.overall_score * 100)}%
                </p>
              )}
            </div>
            <Badge variant={lastAttempt.passed ? 'success' : 'danger'}>
              {lastAttempt.passed ? 'Aprobado' : 'No aprobado'}
            </Badge>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {eligibility?.eligible ? (
          <Link href="/exam/prepare">
            <Button className="w-full" size="lg" variant="gold">
              🎤 Comenzar examen oral
            </Button>
          </Link>
        ) : (
          <Button className="w-full" size="lg" disabled>
            Aún no cumples los requisitos
          </Button>
        )}
        {lastAttempt && (
          <Link href={`/exam/results/${lastAttempt.id}`}>
            <Button variant="ghost" className="w-full">
              Ver último resultado →
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
