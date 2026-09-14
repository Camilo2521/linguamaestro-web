'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ProcessingStream } from '@/components/exam/ProcessingStream';
import { useToast } from '@/stores/ui.store';
import type { EvalEvent } from '@/types/domain.types';

interface Props { params: Promise<{ attemptId: string }> }

export default function ProcessingPage({ params }: Props) {
  const { attemptId } = use(params);
  const router = useRouter();
  const { error } = useToast();

  function handleComplete(_events: EvalEvent[]) {
    router.push(`/exam/results/${attemptId}`);
  }

  function handleError(msg: string) {
    error(msg);
    router.push('/exam');
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center py-12">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Evaluando tu examen</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            La IA está analizando tu grabación. Esto puede tomar 1–2 minutos.
          </p>
        </div>
        <ProcessingStream
          attemptId={attemptId}
          onComplete={handleComplete}
          onError={handleError}
        />
      </div>
    </div>
  );
}
