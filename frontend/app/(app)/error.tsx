'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
        <AlertTriangle size={32} className="text-red-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Algo salió mal</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-2 max-w-xs">
          Ocurrió un error inesperado. Intenta recargar la página.
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--color-text-muted)] mt-2 font-mono">ID: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset} variant="primary">
        <RotateCcw size={14} />
        Intentar de nuevo
      </Button>
    </div>
  );
}
