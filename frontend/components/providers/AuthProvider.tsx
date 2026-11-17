'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { authStorage } from '@/lib/api/client';
import { useSessionStore } from '@/stores/session.store';
import type { UserProfile, Enrollment } from '@/types/domain.types';

const PUBLIC_ROUTES = new Set(['/', '/login', '/register']);
const ONBOARDING_PREFIX = '/onboarding';
const APP_PREFIXES = ['/dashboard', '/learn', '/practice', '/progress', '/settings'];

// Route protection used to live in middleware.ts, reading the Supabase
// session cookie server-side. Now that the frontend is a separate project
// talking to a REST backend, the session only exists as a bearer token in
// localStorage — invisible to Next.js middleware/server components — so
// this client-side provider owns both loading the session AND the
// onboarding/auth redirects middleware used to do.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setEnrollments, clearSession } = useSessionStore();
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const token = authStorage.getAccessToken();
      const isPublic = PUBLIC_ROUTES.has(pathname);
      const isOnboarding = pathname.startsWith(ONBOARDING_PREFIX);
      const isApp = APP_PREFIXES.some((p) => pathname.startsWith(p));

      if (!token) {
        clearSession();
        if (isApp || isOnboarding) router.replace('/login');
        if (!cancelled) setChecked(true);
        return;
      }

      try {
        const { data } = await authApi.me();
        if (cancelled) return;
        setUser(data.user as unknown as UserProfile);
        setEnrollments(data.enrollments as unknown as Enrollment[]);

        const onboardingDone = !!data.user?.onboarding_completed;
        if (isPublic) {
          router.replace(onboardingDone ? '/dashboard' : '/onboarding/welcome');
        } else if (isApp && !onboardingDone) {
          router.replace('/onboarding/welcome');
        } else if (isOnboarding && onboardingDone) {
          router.replace('/dashboard');
        }
      } catch {
        // Invalid/expired token that couldn't be refreshed.
        clearSession();
        if (isApp || isOnboarding) router.replace('/login');
      } finally {
        if (!cancelled) setChecked(true);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [pathname, router, setUser, setEnrollments, clearSession]);

  // Avoid flashing protected content before the first auth check resolves.
  if (!checked && (pathname.startsWith('/onboarding') || APP_PREFIXES.some((p) => pathname.startsWith(p)))) {
    return null;
  }

  return <>{children}</>;
}
