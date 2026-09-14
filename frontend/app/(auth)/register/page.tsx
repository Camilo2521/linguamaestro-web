'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { registerSchema, type RegisterInput } from '@/lib/validations/auth.schema';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/stores/ui.store';

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(data: RegisterInput) {
    setIsPending(true);
    try {
      const result = await authApi.register(data);
      if (result.needsConfirmation) {
        setEmailSent(true);
        toastSuccess('¡Revisa tu email para confirmar tu cuenta!');
      } else {
        router.push('/onboarding/welcome');
      }
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Error inesperado. Inténtalo de nuevo.');
    } finally {
      setIsPending(false);
    }
  }

  if (emailSent) {
    return (
      <div className="text-center space-y-4">
        <div className="text-5xl">📬</div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Revisa tu email</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Te enviamos un enlace de confirmación. Haz clic en él para activar tu cuenta.
        </p>
        <Link href="/login" className="text-[var(--color-accent-primary)] text-sm hover:underline">
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-[var(--radius-2xl)] bg-[var(--color-accent-primary)]/10 border border-[var(--color-accent-primary)]/20 mb-2">
          <span className="text-2xl">🎓</span>
        </div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Comienza tu viaje</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Únete a miles de estudiantes que dominan idiomas
        </p>
      </div>

      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-default)] rounded-[var(--radius-2xl)] p-6 shadow-[var(--shadow-card)]">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Nombre completo"
            placeholder="Tu nombre"
            icon={<User className="h-4 w-4" />}
            error={errors.fullName?.message}
            autoComplete="name"
            {...register('fullName')}
          />

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
            placeholder="Mínimo 8 caracteres"
            icon={showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            iconPosition="right"
            onIconClick={() => setShowPassword((p) => !p)}
            error={errors.password?.message}
            hint="Debe tener mayúscula y número"
            autoComplete="new-password"
            {...register('password')}
          />

          <Input
            label="Confirmar contraseña"
            type={showPassword ? 'text' : 'password'}
            placeholder="Repite tu contraseña"
            icon={<Lock className="h-4 w-4" />}
            error={errors.confirmPassword?.message}
            autoComplete="new-password"
            {...register('confirmPassword')}
          />

          <p className="text-xs text-[var(--color-text-muted)]">
            Al registrarte aceptas nuestros{' '}
            <Link href="/terms" className="text-[var(--color-accent-primary)] hover:underline">Términos</Link>{' '}
            y{' '}
            <Link href="/privacy" className="text-[var(--color-accent-primary)] hover:underline">Privacidad</Link>.
          </p>

          <Button type="submit" className="w-full" loading={isPending}>
            Crear cuenta gratis
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-[var(--color-accent-primary)] font-semibold hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
