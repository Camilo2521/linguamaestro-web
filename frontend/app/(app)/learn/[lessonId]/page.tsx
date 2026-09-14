'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LessonEngine } from './LessonEngine';
import { lessonsApi } from '@/lib/api/lessons';
import { authApi } from '@/lib/api/auth';
import { Skeleton } from '@/components/ui/skeleton';

export default function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const router = useRouter();
  const [state, setState] = useState<{ lesson: any; exercises: any[]; enrollmentId: string } | 'not-found' | null>(null);

  useEffect(() => {
    // Fetch the enrollment fresh rather than trusting the Zustand store —
    // on a direct load/refresh the store hasn't been populated by
    // AuthProvider yet, so reading it synchronously during render would
    // bounce a fully-onboarded user back to onboarding every time.
    let cancelled = false;
    authApi.me().then(async ({ data }) => {
      if (cancelled) return;
      const enrollment = data.enrollments[0];
      if (!enrollment) {
        router.replace('/onboarding/language');
        return;
      }
      try {
        const res = await lessonsApi.get(lessonId, enrollment.id);
        if (cancelled) return;
        if (res.data.exercises.length === 0) {
          router.replace('/learn');
          return;
        }
        setState({ lesson: res.data.lesson, exercises: res.data.exercises, enrollmentId: enrollment.id });
      } catch {
        if (!cancelled) setState('not-found');
      }
    });
    return () => { cancelled = true; };
  }, [lessonId, router]);

  if (state === 'not-found') {
    return <p className="text-center py-12 text-[var(--color-text-muted)]">Lección no encontrada.</p>;
  }

  if (!state) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton height={40} />
        <Skeleton height={200} />
      </div>
    );
  }

  return <LessonEngine lesson={state.lesson} exercises={state.exercises} enrollmentId={state.enrollmentId} />;
}
