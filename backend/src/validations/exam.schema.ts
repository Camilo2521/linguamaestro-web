import { z } from 'zod';

export const examEligibilitySchema = z.object({
  enrollmentId: z.string().uuid(),
});

export const examAttemptSchema = z.object({
  enrollmentId: z.string().uuid(),
  videoUrl: z.string().url(),
  durationSeconds: z.number().int().min(60).max(600),
});

export const evalFeedbackSchema = z.object({
  fluency: z.number().min(0).max(100),
  pronunciation: z.number().min(0).max(100),
  grammar: z.number().min(0).max(100),
  vocabulary: z.number().min(0).max(100),
  coherence: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  passed: z.boolean(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  detectedErrors: z.array(z.object({
    type: z.string(),
    original: z.string(),
    correction: z.string(),
    explanation: z.string(),
    timestamp: z.number().optional(),
  })),
  improvementPlan: z.array(z.object({
    week: z.number().int().min(1),
    task: z.string(),
    resources: z.array(z.string()),
    estimatedMinutes: z.number().int(),
  })),
  transcript: z.string(),
});

export type ExamAttemptInput = z.infer<typeof examAttemptSchema>;
export type EvalFeedbackInput = z.infer<typeof evalFeedbackSchema>;
