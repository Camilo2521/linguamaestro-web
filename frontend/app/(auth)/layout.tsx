import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Acceder',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bg-base)]">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.15) 0%, transparent 60%)',
        }}
      />
      <main className="w-full max-w-md relative z-10">{children}</main>
    </div>
  );
}
