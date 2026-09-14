'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@/lib/validations/auth.schema';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/stores/ui.store';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const { error: toastError } = useToast();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setIsPending(true);
    try {
      await authApi.login(data);
      router.push('/dashboard');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Error inesperado. Inténtalo de nuevo.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-[var(--radius-2xl)] bg-[var(--color-accent-primary)]/10 border border-[var(--color-accent-primary)]/20 mb-2">
          <span className="text-2xl">🎓</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Bienvenido de vuelta</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Continúa tu camino hacia la fluidez
        </p>
      </div>

      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded-[var(--radius-2xl)] p-6 shadow-[var(--shadow-card)]">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="tu@email.com"
            icon={<Mail className="h-4 w-4" />}
            error={errors.email?.message}
            autoComplete="email"
            {...register('email')}
          />

          <Input
            label="Contraseña"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            icon={showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            iconPosition="right"
            onIconClick={() => setShowPassword((p) => !p)}
            error={errors.password?.message}
            autoComplete="current-password"
            {...register('password')}
          />

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs text-[var(--color-accent-primary)] hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={isPending}>
            Iniciar sesión
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        ¿No tienes cuenta?{' '}
        <Link href="/register" className="text-[var(--color-accent-primary)] font-semibold hover:underline">
          Regístrate gratis
        </Link>
      </p>
    </div>
  );
}
