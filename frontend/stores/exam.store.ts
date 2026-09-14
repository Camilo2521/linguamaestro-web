import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { EvalEvent, DimensionScores } from '@/types/domain.types';

type ExamPhase = 'idle' | 'prepare' | 'recording' | 'uploading' | 'processing' | 'results';

interface ExamState {
  phase: ExamPhase;
  attemptId: string | null;
  videoBlob: Blob | null;
  uploadProgress: number;
  evalEvents: EvalEvent[];
  finalScore: number | null;
  dimensionScores: DimensionScores | null;
  passed: boolean | null;
  error: string | null;

  setPhase: (phase: ExamPhase) => void;
  setAttemptId: (id: string) => void;
  setVideoBlob: (blob: Blob) => void;
  setUploadProgress: (pct: number) => void;
  addEvalEvent: (event: EvalEvent) => void;
  setResults: (score: number, dimensions: DimensionScores, passed: boolean) => void;
  setError: (error: string) => void;
  reset: () => void;
}

const INITIAL: Omit<ExamState, keyof { setPhase: unknown; setAttemptId: unknown; setVideoBlob: unknown; setUploadProgress: unknown; addEvalEvent: unknown; setResults: unknown; setError: unknown; reset: unknown }> = {
  phase: 'idle',
  attemptId: null,
  videoBlob: null,
  uploadProgress: 0,
  evalEvents: [],
  finalScore: null,
  dimensionScores: null,
  passed: null,
  error: null,
};

export const useExamStore = create<ExamState>()(
  devtools(
    (set) => ({
      ...INITIAL,

      setPhase: (phase) => set({ phase }),
      setAttemptId: (attemptId) => set({ attemptId }),
      setVideoBlob: (videoBlob) => set({ videoBlob }),
      setUploadProgress: (uploadProgress) => set({ uploadProgress }),
      addEvalEvent: (event) =>
        set((state) => ({ evalEvents: [...state.evalEvents, event] })),
      setResults: (finalScore, dimensionScores, passed) =>
        set({ finalScore, dimensionScores, passed, phase: 'results' }),
      setError: (error) => set({ error, phase: 'idle' }),
      reset: () => set({ ...INITIAL }),
    }),
    { name: 'ExamStore' },
  ),
);
