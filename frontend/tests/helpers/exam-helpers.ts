import type { AIFeedback, DimensionScores, ExamEligibility } from '@/types/domain.types';

export function makeDimensionScores(overrides: Partial<DimensionScores> = {}): DimensionScores {
  return {
    fluency: 0.80,
    pronunciation: 0.75,
    grammar: 0.82,
    vocabulary: 0.85,
    coherence: 0.78,
    ...overrides,
  };
}

export function makeAIFeedback(overrides: Partial<AIFeedback> = {}): AIFeedback {
  return {
    overall_score: 0.80,
    passed: true,
    dimension_scores: makeDimensionScores(),
    strengths: ['Vocabulario amplio', 'Buena fluidez'],
    weaknesses: ['Pronunciación de consonantes finales'],
    detected_errors: [
      {
        type: 'pronunciation',
        original: 'she lived',
        correction: 'she lived (énfasis en /d/)',
        explanation: 'La /d/ final debe ser audible',
        timestamp: 45.2,
      },
    ],
    improvement_plan: [
      {
        week: 1,
        task: 'Minimal pairs con sonidos /p/ /b/  /t/ /d/',
        resources: ['Forvo', 'Cambridge Dictionary'],
        estimatedMinutes: 20,
      },
    ],
    feedback_summary: 'Buen desempeño global. Practica pronunciación de consonantes finales.',
    ...overrides,
  };
}

export function makeEligibility(overrides: Partial<ExamEligibility> = {}): ExamEligibility {
  return {
    eligible: true,
    reasons: [],
    hoursStudied: 95,
    requiredHours: 90,
    monthsStudied: 4.0,
    requiredMonths: 3,
    lastAttemptDate: null,
    cooldownDaysRemaining: 0,
    ...overrides,
  };
}

/** Overall score computed as equal-weight average of 5 dimensions. */
export function averageDimensions(scores: DimensionScores): number {
  const values = Object.values(scores);
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Determine pass/fail for a given level's minimum score. */
export function determinePass(overallScore: number, minScoreToPass: number): boolean {
  return overallScore >= minScoreToPass;
}
