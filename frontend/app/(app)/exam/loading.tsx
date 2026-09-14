import { CardSkeleton, StatSkeleton } from '@/components/ui/skeleton';

export default function ExamLoading() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="h-8 w-40 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] animate-pulse" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <StatSkeleton key={i} />)}
      </div>
      <CardSkeleton lines={6} />
    </div>
  );
}
