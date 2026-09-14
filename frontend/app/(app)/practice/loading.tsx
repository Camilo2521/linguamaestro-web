import { CardSkeleton } from '@/components/ui/skeleton';

export default function PracticeLoading() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="h-8 w-44 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] animate-pulse" />
      {Array.from({ length: 3 }).map((_, i) => (
        <CardSkeleton key={i} lines={2} />
      ))}
    </div>
  );
}
