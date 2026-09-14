'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { cn } from '@/lib/utils/cn';

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  default: Info,
};

const COLORS = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  error: 'border-red-500/40 bg-red-500/10 text-red-400',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  default: 'border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]',
};

export function Toaster() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.variant];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'pointer-events-auto flex items-center gap-3 rounded-[var(--radius-xl)]',
                'border px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-sm',
                'min-w-[280px] max-w-sm text-sm font-medium',
                COLORS[toast.variant],
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
