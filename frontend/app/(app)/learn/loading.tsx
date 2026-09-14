import { CardSkeleton } from '@/components/ui/skeleton';

export default function LearnLoading() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="h-2 w-full rounded-full bg-[var(--color-bg-subtle)] animate-pulse" />
      <CardSkeleton lines={5} />
    </div>
  );
}
