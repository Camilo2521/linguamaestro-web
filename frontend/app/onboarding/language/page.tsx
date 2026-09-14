'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { onboardingApi } from '@/lib/api/onboarding';
import { ApiError } from '@/lib/api/client';
import { LANGUAGE_LIST } from '@/lib/utils/languages';
import { Button } from '@/components/ui/button';
import { useToast } from '@/stores/ui.store';
import { cn } from '@/lib/utils/cn';
import type { LanguageCode } from '@/types/domain.types';

export default function LanguagePage() {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [selected, setSelected] = useState<LanguageCode | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleContinue() {
    if (!selected) return;
    setIsPending(true);
    try {
      await onboardingApi.createEnrollment(selected);
      router.push('/onboarding/native');
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'No se pudo crear la inscripción');
      setIsPending(false);
    }
  }

  return (
    <div className="py-8 space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">¿Qué idioma quieres aprender?</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">Puedes agregar más idiomas después.</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LANGUAGE_LIST.map((lang, i) => (
          <motion.button
            key={lang.code}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => setSelected(lang.code as LanguageCode)}
            className={cn(
              'flex items-center gap-4 p-4 rounded-[var(--radius-xl)] border text-left transition-all duration-200',
              selected === lang.code
                ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/8 shadow-[0_0_0_1px_var(--color-accent-primary)]'
                : 'border-[var(--color-border-default)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-strong)]',
            )}
          >
            <span className="text-3xl">{lang.flag}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[var(--color-text-primary)]">{lang.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{lang.nativeName}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{lang.description}</p>
            </div>
            {selected === lang.code && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-5 h-5 rounded-full bg-[var(--color-accent-primary)] flex items-center justify-center shrink-0"
              >
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>

      <Button className="w-full" size="lg" disabled={!selected} loading={isPending} onClick={handleContinue}>
        Continuar →
      </Button>
    </div>
  );
}
