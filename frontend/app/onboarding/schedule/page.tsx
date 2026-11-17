'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { onboardingApi } from '@/lib/api/onboarding';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/stores/session.store';
import { useToast } from '@/stores/ui.store';
import { cn } from '@/lib/utils/cn';

const GOALS = [
  { value: 15, label: '15 min/día', sub: 'Ritmo casual', icon: '🌱' },
  { value: 30, label: '30 min/día', sub: 'Progreso constante', icon: '⚡', recommended: true },
  { value: 60, label: '1 hora/día', sub: 'Aprendizaje intensivo', icon: '🔥' },
  { value: 90, label: '90 min/día', sub: 'Modo maratón', icon: '🚀' },
];

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function SchedulePage() {
  const router = useRouter();
  const { updateUser } = useSessionStore();
  const { error: toastError } = useToast();
  const [dailyMinutes, setDailyMinutes] = useState(30);
  // DAYS[0] is 'Lun' (Monday), so weekdays are indices 0-4, not 1-5 — the
  // previous default pre-selected Tue-Sat instead of Mon-Fri.
  const [activeDays, setActiveDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [isPending, setIsPending] = useState(false);

  function toggleDay(i: number) {
    setActiveDays((prev) =>
      prev.includes(i) ? (prev.length > 1 ? prev.filter((d) => d !== i) : prev) : [...prev, i],
    );
  }

  async function handleFinish() {
    setIsPending(true);
    try {
      // The backend guards this too: onboarding_completed unlocks the whole
      // app, but every protected page also requires an active enrollment —
      // setting the flag without one would trap the account in a redirect loop.
      await onboardingApi.complete(dailyMinutes, activeDays);
      updateUser({ onboarding_completed: true, daily_goal_minutes: dailyMinutes });
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NO_ENROLLMENT') {
        toastError('Primero elige un idioma para aprender.');
        router.push('/onboarding/language');
        return;
      }
      toastError(err instanceof ApiError ? err.message : 'No se pudo finalizar el onboarding');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="py-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Tu plan de estudio</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          La constancia supera a la intensidad. Elige un ritmo que puedas mantener.
        </p>
      </motion.div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Tiempo diario</p>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((g) => (
            <button
              key={g.value}
              onClick={() => setDailyMinutes(g.value)}
              className={cn(
                'relative flex flex-col items-start p-4 rounded-[var(--radius-xl)] border transition-all duration-200 text-left',
                dailyMinutes === g.value
                  ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/8'
                  : 'border-[var(--color-border-default)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-strong)]',
              )}
            >
              {g.recommended && (
                <span className="absolute -top-2 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-accent-primary)] text-white">
                  Recomendado
                </span>
              )}
              <span className="text-xl mb-1">{g.icon}</span>
              <span className="font-semibold text-sm text-[var(--color-text-primary)]">{g.label}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{g.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Días activos</p>
        <div className="flex gap-1.5">
          {DAYS.map((day, i) => (
            <button
              key={day}
              onClick={() => toggleDay(i)}
              className={cn(
                'flex-1 py-2.5 rounded-[var(--radius-md)] text-xs font-semibold transition-all duration-150',
                activeDays.includes(i)
                  ? 'bg-[var(--color-accent-primary)] text-white'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] border border-[var(--color-border-default)]',
              )}
            >
              {day}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          {activeDays.length} días/semana · {((dailyMinutes * activeDays.length) / 60).toFixed(1)}h semanales
        </p>
      </div>

      <Button size="lg" className="w-full" onClick={handleFinish} loading={isPending}>
        ¡Comenzar mi camino! 🎉
      </Button>
    </div>
  );
}
