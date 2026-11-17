import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { SRSItem } from '@/types/domain.types';

interface SRSState {
  queue: SRSItem[];
  currentIndex: number;
  sessionCorrect: number;
  sessionTotal: number;
  sessionStartedAt: Date | null;
  initialQueueSize: number;
  isFlipped: boolean;

  setQueue: (items: SRSItem[]) => void;
  flipCard: () => void;
  rateCard: (quality: 0 | 1 | 2 | 3 | 4 | 5) => void;
  resetSession: () => void;
}

export const useSRSStore = create<SRSState>()(
  devtools(
    (set, get) => ({
      queue: [],
      currentIndex: 0,
      sessionCorrect: 0,
      sessionTotal: 0,
      sessionStartedAt: null,
      initialQueueSize: 0,
      isFlipped: false,

      // Called on every refetch of the due-items query, including the one
      // triggered by invalidateQueries() after each single card review — not
      // just once per session. Resetting sessionCorrect/sessionTotal here
      // unconditionally wiped the running tally after every card, so the
      // session-complete screen always reported 0% regardless of real
      // performance. Only seed session counters the first time (when no
      // session is in progress yet); preserve them across mid-session refetches.
      //
      // initialQueueSize is seeded the same way and never touched again: the
      // live `queue` shrinks after every review (the server's "due" filter
      // naturally excludes whatever was just reviewed), so it can't be used
      // as the progress bar's denominator — that made the counter regress
      // after every card and made progress.total hit 0 at the end of every
      // completed session, permanently hiding the "session complete" screen
      // behind the "nothing was due" one.
      setQueue: (queue) =>
        set((state) => ({
          queue,
          currentIndex: 0,
          isFlipped: false,
          sessionCorrect: state.sessionStartedAt ? state.sessionCorrect : 0,
          sessionTotal: state.sessionStartedAt ? state.sessionTotal : 0,
          initialQueueSize: state.sessionStartedAt ? state.initialQueueSize : queue.length,
          sessionStartedAt: state.sessionStartedAt ?? new Date(),
        })),

      flipCard: () => set({ isFlipped: true }),

      rateCard: (quality) => {
        const { currentIndex, queue, sessionCorrect, sessionTotal } = get();
        const passed = quality >= 3;

        set({
          currentIndex: Math.min(currentIndex + 1, queue.length),
          sessionCorrect: passed ? sessionCorrect + 1 : sessionCorrect,
          sessionTotal: sessionTotal + 1,
          isFlipped: false,
        });
      },

      resetSession: () =>
        set({ queue: [], currentIndex: 0, sessionCorrect: 0, sessionTotal: 0, sessionStartedAt: null, initialQueueSize: 0, isFlipped: false }),
    }),
    { name: 'SRSStore' },
  ),
);

export const useCurrentCard = () => {
  const { queue, currentIndex } = useSRSStore();
  return queue[currentIndex] ?? null;
};

export const useSRSProgress = () => {
  const { currentIndex, queue, sessionCorrect, sessionTotal, initialQueueSize } = useSRSStore();
  return {
    // done/total use the session's fixed original size and the running
    // review count — not currentIndex/queue.length, which both reset/shrink
    // on every refetch and would make the counter regress after each card.
    done: sessionTotal,
    total: initialQueueSize,
    remaining: queue.length - currentIndex,
    accuracy: sessionTotal > 0 ? sessionCorrect / sessionTotal : 0,
    isFinished: currentIndex >= queue.length,
  };
};
