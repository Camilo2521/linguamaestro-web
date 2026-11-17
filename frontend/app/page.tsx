import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LinguaMaestro — Aprende idiomas con niveles CEFR',
};

const LANGUAGES = [
  { flag: '🇬🇧', name: 'Inglés' },
  { flag: '🇫🇷', name: 'Francés' },
  { flag: '🇧🇷', name: 'Portugués' },
  { flag: '🇪🇸', name: 'Español' },
  { flag: '🇯🇵', name: 'Japonés' },
  { flag: '🇨🇳', name: 'Mandarín' },
];

const FEATURES = [
  { icon: '🧠', title: 'Repetición espaciada', desc: 'Algoritmo SM-2 que programa tus repasos justo antes de que olvides' },
  { icon: '🎤', title: 'Práctica integral', desc: 'Habla libre, shadowing, debate y escritura en cada nivel' },
  { icon: '📜', title: 'Niveles CEFR', desc: 'Progresión estructurada de A1 a nivel nativo' },
  { icon: '🔥', title: 'Gamificación', desc: 'Rachas, logros y competencias para mantener el hábito' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)]">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 60%)' }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎓</span>
          <span className="font-bold text-[var(--color-text-primary)]">LinguaMaestro</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Iniciar sesión</Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Empezar gratis</Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center space-y-16">
        <div className="space-y-6">
          <h1 className="text-4xl sm:text-6xl font-black text-[var(--color-text-primary)] leading-tight">
            Domina idiomas con{' '}
            <span className="text-[var(--color-accent-primary)]">ciencia real</span>
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-xl mx-auto leading-relaxed">
            Repetición espaciada (SM-2) + práctica oral y escrita + niveles CEFR de A1 a nativo. El método que usan los políglotas de élite.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link href="/register">
              <Button size="lg" variant="gold">🎓 Comenzar gratis</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">Ya tengo cuenta</Button>
            </Link>
          </div>
        </div>

        <div className="flex justify-center gap-4 flex-wrap">
          {LANGUAGES.map((l) => (
            <div
              key={l.name}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border-default)]"
            >
              <span className="text-xl">{l.flag}</span>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{l.name}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex gap-4 p-5 rounded-[var(--radius-2xl)] bg-[var(--color-bg-card)] border border-[var(--color-border-default)] text-left"
            >
              <span className="text-3xl shrink-0">{f.icon}</span>
              <div>
                <h3 className="font-bold text-[var(--color-text-primary)]">{f.title}</h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Empieza hoy mismo</h2>
          <Link href="/register">
            <Button size="lg" className="px-12">Crear cuenta gratuita →</Button>
          </Link>
          <p className="text-xs text-[var(--color-text-muted)]">Sin tarjeta de crédito · Cancela cuando quieras</p>
        </div>
      </main>
    </div>
  );
}
