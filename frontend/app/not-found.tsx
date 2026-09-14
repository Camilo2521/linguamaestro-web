import Link from 'next/link';
import { Home, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 text-center px-4 bg-[var(--color-bg-base)]">
      <div className="p-4 rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-default)]">
        <SearchX size={40} className="text-[var(--color-text-muted)]" />
      </div>
      <div>
        <h1 className="text-5xl font-black text-[var(--color-text-primary)]">404</h1>
        <p className="text-lg font-semibold text-[var(--color-text-primary)] mt-2">Página no encontrada</p>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-xs">
          Esta página no existe o fue movida a otra dirección.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-lg)] bg-[var(--color-accent-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Home size={14} />
        Ir al inicio
      </Link>
    </div>
  );
}
