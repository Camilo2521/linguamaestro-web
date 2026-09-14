import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Configuración inicial' };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 60%)',
        }}
      />

      <header className="relative z-10 flex justify-center pt-8 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎓</span>
          <span className="font-bold text-[var(--color-text-primary)]">LinguaMaestro</span>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center px-4 pb-8">
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}
