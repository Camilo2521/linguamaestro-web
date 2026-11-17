import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type { UserProfile, Enrollment } from '@/types/domain.types';

interface SessionState {
  user: UserProfile | null;
  enrollments: Enrollment[];
  activeEnrollmentId: string | null;

  setUser: (user: UserProfile | null) => void;
  setEnrollments: (enrollments: Enrollment[]) => void;
  setActiveEnrollment: (id: string) => void;
  updateUser: (patch: Partial<UserProfile>) => void;
  updateEnrollment: (id: string, patch: Partial<Enrollment>) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        enrollments: [],
        activeEnrollmentId: null,

        setUser: (user) => set({ user }),

        setEnrollments: (enrollments) =>
          set({ enrollments, activeEnrollmentId: enrollments[0]?.id ?? null }),

        setActiveEnrollment: (id) => set({ activeEnrollmentId: id }),

        updateUser: (patch) =>
          set((state) => ({
            user: state.user ? { ...state.user, ...patch } : null,
          })),

        updateEnrollment: (id, patch) =>
          set((state) => ({
            enrollments: state.enrollments.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          })),

        clearSession: () =>
          set({ user: null, enrollments: [], activeEnrollmentId: null }),
      }),
      {
        name: 'lm-session',
        partialize: (state) => ({
          activeEnrollmentId: state.activeEnrollmentId,
        }),
      },
    ),
    { name: 'SessionStore' },
  ),
);

export const useActiveEnrollment = () => {
  const { enrollments, activeEnrollmentId } = useSessionStore();
  return enrollments.find((e) => e.id === activeEnrollmentId) ?? enrollments[0] ?? null;
};
