'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getLevelColor, LEVEL_ORDER, LEVELS } from '@/lib/utils/levels';
import type { CEFRLevel } from '@/types/domain.types';
import { dashboardApi } from '@/lib/api/dashboard';

export default function ProgressPage() {
  const router = useRouter();
  const [data, setData] = useState<{ enrollment: any; logs: any[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    dashboardApi.progress().then(
      (res) => { if (!cancelled) setData(res.data); },
      () => { if (!cancelled) router.replace('/onboarding/language'); },
    );
    return () => { cancelled = true; };
  }, [router]);

  if (!data) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Skeleton height={40} />
        <Skeleton height={120} />
      </div>
    );
  }

  const { enrollment, logs } = data;
  const currentLevelIndex = LEVEL_ORDER.indexOf(enrollment.current_level as CEFRLevel);
  const totalXP = logs.reduce((s: number, l: any) => s + (l.xp_earned ?? 0), 0);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Mi progreso</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Nivel actual y camino hacia la maestría</p>
      </div>

      <Card variant="elevated">
        <CardHeader><CardTitle className="text-base">Ruta CEFR</CardTitle></CardHeader>
        <CardContent>
          <div className="relative flex items-center">
            <div className="absolute left-4 right-4 top-4 h-0.5 bg-[var(--color-bg-overlay)]" />
            <div className="flex justify-between w-full relative">
              {LEVEL_ORDER.map((level, i) => {
                const done = i < currentLevelIndex;
                const active = i === currentLevelIndex;
                const config = LEVELS[level];
                return (
                  <div key={level} className="flex flex-col items-center gap-1">
                    <div
                      className="relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all"
                      style={{
                        borderColor: done || active ? getLevelColor(level) : 'var(--color-border-default)',
                        background: done ? getLevelColor(level) : active ? `${getLevelColor(level)}20` : 'var(--color-bg-card)',
                      }}
                    >
                      {done ? (
                        <span className="text-white text-xs font-bold">✓</span>
                      ) : (
                        <span className="text-xs font-bold" style={{ color: active ? getLevelColor(level) : 'var(--color-text-muted)' }}>
                          {level}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-[var(--color-text-muted)] hidden sm:block">{config.label.split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'XP total', value: totalXP.toLocaleString(), unit: 'puntos' },
          { label: 'Horas totales', value: Math.round(enrollment.total_study_hours ?? 0).toString(), unit: 'horas' },
        ].map(({ label, value, unit }) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{unit}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Actividad reciente</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {logs.slice(0, 7).map((log: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-base">
                  {log.activity_type === 'lesson' ? '📖' : log.activity_type === 'srs' ? '🧠' : '🎤'}
                </span>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-primary)] capitalize">{log.activity_type}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {new Date(log.created_at).toLocaleDateString('es-ES')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--color-text-secondary)]">{log.duration_minutes} min</p>
                <p className="text-[10px] text-[var(--color-accent-gold)] font-semibold">+{log.xp_earned} XP</p>
              </div>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
              Sin actividad registrada aún. ¡Empieza una lección!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
