'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Bell, Shield, LogOut, ChevronRight, Moon, Globe, Clock, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useSessionStore } from '@/stores/session.store';
import { useToast } from '@/stores/ui.store';
import { authApi } from '@/lib/api/auth';
import { dashboardApi } from '@/lib/api/dashboard';
import { ApiError } from '@/lib/api/client';

const DAILY_GOALS = [
  { value: 15, label: '15 min', desc: 'Ligero' },
  { value: 30, label: '30 min', desc: 'Regular' },
  { value: 60, label: '60 min', desc: 'Intensivo' },
  { value: 90, label: '90 min', desc: 'Avanzado' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, enrollments, clearSession, updateUser } = useSessionStore();
  const { error: toastError, success: toastSuccess } = useToast();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(user?.daily_goal_minutes ?? 30);
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  const enrollment = enrollments[0] ?? null;

  async function handleGoalChange(value: number) {
    const previous = selectedGoal;
    setSelectedGoal(value);
    setIsSavingGoal(true);
    try {
      await dashboardApi.updateDailyGoal(value);
      updateUser({ daily_goal_minutes: value });
      toastSuccess('Meta diaria actualizada');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'No se pudo guardar la meta diaria.');
      setSelectedGoal(previous);
    } finally {
      setIsSavingGoal(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await authApi.logout();
      clearSession();
      router.push('/login');
    } catch {
      toastError('Error al cerrar sesión');
      setIsSigningOut(false);
    }
  }

  const LANGUAGE_NAMES: Record<string, string> = {
    es: 'Español', en: 'Inglés', fr: 'Francés', de: 'Alemán', it: 'Italiano', pt: 'Portugués',
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Ajustes</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Gestiona tu cuenta y preferencias</p>
      </div>

      {/* Profile card */}
      <Card variant="elevated">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <UserAvatar
              name={user?.full_name ?? user?.email ?? 'U'}
              src={user?.avatar_url ?? undefined}
              size="xl"
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[var(--color-text-primary)] truncate">
                {user?.full_name ?? 'Sin nombre'}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] truncate">{user?.email}</p>
              {enrollment && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge size="sm">{enrollment.current_level}</Badge>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {LANGUAGE_NAMES[enrollment.language_code] ?? enrollment.language_code}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily goal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock size={14} className="text-[var(--color-accent-primary)]" />
            Meta diaria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {DAILY_GOALS.map(({ value, label, desc }) => (
              <button
                key={value}
                disabled={isSavingGoal}
                onClick={() => handleGoalChange(value)}
                className={`p-3 rounded-[var(--radius-lg)] border text-center transition-all disabled:opacity-60 ${
                  selectedGoal === value
                    ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10'
                    : 'border-[var(--color-border-default)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-strong)]'
                }`}
              >
                <p className={`text-sm font-bold ${selectedGoal === value ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-primary)]'}`}>
                  {label}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settings list */}
      <Card>
        <CardContent className="p-0">
          {[
            { icon: User, label: 'Editar perfil', desc: 'Nombre y foto de perfil', action: () => {} },
            { icon: Globe, label: 'Idioma de la app', desc: 'Español', action: () => {} },
            { icon: Bell, label: 'Notificaciones', desc: 'Recordatorios diarios', action: () => {} },
            { icon: Moon, label: 'Tema', desc: 'Oscuro', action: () => {} },
            { icon: Shield, label: 'Privacidad y seguridad', desc: 'Contraseña y datos', action: () => {} },
          ].map(({ icon: Icon, label, desc, action }, i, arr) => (
            <div key={label}>
              <button
                onClick={action}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-bg-subtle)] transition-colors text-left"
              >
                <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)]">
                  <Icon size={16} className="text-[var(--color-text-secondary)]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{desc}</p>
                </div>
                <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
              </button>
              {i < arr.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Stats */}
      {enrollment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Estadísticas de cuenta</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            {[
              { label: 'Racha actual', value: `${user?.current_streak ?? 0}d` },
              { label: 'Racha máx.', value: `${user?.longest_streak ?? 0}d` },
              { label: 'XP total', value: (enrollment.xp_total ?? 0).toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-lg font-bold text-[var(--color-text-primary)]">{value}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{label}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      <div className="space-y-3">
        <Button
          variant="danger"
          className="w-full"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          <LogOut size={16} />
          {isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </Button>
        <button className="w-full flex items-center justify-center gap-2 text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-colors py-2">
          <Trash2 size={12} />
          Eliminar cuenta
        </button>
      </div>

      <p className="text-center text-xs text-[var(--color-text-muted)] pb-4">
        LinguaMaestro v1.0.0 · <a href="#" className="underline">Términos</a> · <a href="#" className="underline">Privacidad</a>
      </p>
    </div>
  );
}
