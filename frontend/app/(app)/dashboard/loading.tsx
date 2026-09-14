import { CardSkeleton, StatSkeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="h-8 w-48 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] animate-pulse" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>

      <CardSkeleton lines={4} />
      <CardSkeleton lines={3} />
    </div>
  );
}
