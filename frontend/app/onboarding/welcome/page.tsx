'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/stores/session.store';

const FEATURES = [
  { icon: '🧠', title: 'Método científico', desc: 'Repetición espaciada (SM-2) que se adapta a tu memoria' },
  { icon: '🎤', title: 'Práctica integral', desc: 'Habla libre, shadowing, debate y escritura' },
  { icon: '📜', title: 'Niveles CEFR', desc: 'Progresión estructurada de A1 a nivel nativo' },
  { icon: '🔥', title: 'Rachas y logros', desc: 'Gamificación que mantiene el hábito diario' },
];

export default function WelcomePage() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);

  return (
    <div className="py-8 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <motion.div
          animate={{ rotate: [0, -5, 5, -5, 0] }}
          transition={{ duration: 1.5, delay: 0.5 }}
          className="text-6xl"
        >
          🎓
        </motion.div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
          Bienvenido{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-[var(--color-text-secondary)] max-w-sm mx-auto">
          En 5 minutos configuraremos tu ruta personalizada hacia la fluidez.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="flex gap-3 p-4 rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] border border-[var(--color-border-default)]"
          >
            <span className="text-2xl shrink-0">{f.icon}</span>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{f.title}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Button
          className="w-full"
          size="lg"
          onClick={() => router.push('/onboarding/language')}
        >
          Empezar configuración →
        </Button>
        <p className="text-center text-xs text-[var(--color-text-muted)] mt-3">
          Solo toma 5 minutos · Sin tarjeta de crédito
        </p>
      </motion.div>
    </div>
  );
}
