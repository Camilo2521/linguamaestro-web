import { describe, it, expect } from 'vitest';
import { LEVELS, getLevelIndex, getNextLevel } from '@/lib/utils/levels';
import { evalFeedbackSchema } from '@/lib/validations/exam.schema';
import {
  averageDimensions,
  determinePass,
  makeDimensionScores,
} from '../../helpers/exam-helpers';
import type { CEFRLevel } from '@/types/domain.types';

describe('LEVELS config — pass thresholds', () => {
  it('A1 requires 70% to pass', () => {
    expect(LEVELS['A1']?.min_score_to_pass).toBe(0.70);
  });

  it('C2 requires 88% to pass', () => {
    expect(LEVELS['C2']?.min_score_to_pass).toBe(0.88);
  });

  it('each higher level has >= pass threshold than A1', () => {
    const levels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const a1Threshold = LEVELS['A1']!.min_score_to_pass;
    for (const level of levels) {
      expect(LEVELS[level]!.min_score_to_pass).toBeGreaterThanOrEqual(a1Threshold);
    }
  });

  it('pass threshold increases monotonically from A1 to C2', () => {
    const ordered: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    for (let i = 1; i < ordered.length; i++) {
      const prev = LEVELS[ordered[i - 1]!]!.min_score_to_pass;
      const curr = LEVELS[ordered[i]!]!.min_score_to_pass;
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });
});

describe('determinePass', () => {
  it('passes when score equals minimum', () => {
    expect(determinePass(0.70, 0.70)).toBe(true);
  });

  it('passes when score exceeds minimum', () => {
    expect(determinePass(0.95, 0.70)).toBe(true);
  });

  it('fails when score is 1 point below minimum', () => {
    expect(determinePass(0.69, 0.70)).toBe(false);
  });

  it('fails at score 0', () => {
    expect(determinePass(0, 0.70)).toBe(false);
  });

  it('passes at score 1.0 for any threshold', () => {
    expect(determinePass(1.0, 0.88)).toBe(true);
  });
});

describe('averageDimensions', () => {
  it('computes equal-weight average of 5 dimensions', () => {
    const scores = makeDimensionScores({
      fluency: 0.8,
      pronunciation: 0.8,
      grammar: 0.8,
      vocabulary: 0.8,
      coherence: 0.8,
    });
    expect(averageDimensions(scores)).toBeCloseTo(0.8);
  });

  it('a perfect set of 1.0 scores yields 1.0', () => {
    const scores = makeDimensionScores({
      fluency: 1.0,
      pronunciation: 1.0,
      grammar: 1.0,
      vocabulary: 1.0,
      coherence: 1.0,
    });
    expect(averageDimensions(scores)).toBeCloseTo(1.0);
  });

  it('a zero set yields 0', () => {
    const scores = makeDimensionScores({
      fluency: 0,
      pronunciation: 0,
      grammar: 0,
      vocabulary: 0,
      coherence: 0,
    });
    expect(averageDimensions(scores)).toBeCloseTo(0);
  });

  it('is sensitive to outlier dimensions', () => {
    const good = makeDimensionScores({ fluency: 1.0, pronunciation: 1.0, grammar: 1.0, vocabulary: 1.0, coherence: 1.0 });
    const bad = makeDimensionScores({ fluency: 0.0, pronunciation: 1.0, grammar: 1.0, vocabulary: 1.0, coherence: 1.0 });
    expect(averageDimensions(bad)).toBeLessThan(averageDimensions(good));
  });
});

describe('evalFeedbackSchema validation', () => {
  const validPayload = {
    fluency: 80,
    pronunciation: 75,
    grammar: 82,
    vocabulary: 88,
    coherence: 79,
    overallScore: 81,
    passed: true,
    strengths: ['Good vocabulary'],
    weaknesses: ['Final consonants'],
    detectedErrors: [
      {
        type: 'pronunciation',
        original: 'lived',
        correction: 'livd',
        explanation: 'Final /d/ must be audible',
        timestamp: 12.5,
      },
    ],
    improvementPlan: [
      {
        week: 1,
        task: 'Minimal pairs practice',
        resources: ['Forvo'],
        estimatedMinutes: 20,
      },
    ],
    transcript: 'I think technology has changed...',
  };

  it('accepts valid feedback payload', () => {
    expect(() => evalFeedbackSchema.parse(validPayload)).not.toThrow();
  });

  it('rejects score above 100', () => {
    expect(() =>
      evalFeedbackSchema.parse({ ...validPayload, fluency: 101 }),
    ).toThrow();
  });

  it('rejects negative score', () => {
    expect(() =>
      evalFeedbackSchema.parse({ ...validPayload, grammar: -1 }),
    ).toThrow();
  });

  it('rejects non-integer week in improvement plan', () => {
    expect(() =>
      evalFeedbackSchema.parse({
        ...validPayload,
        improvementPlan: [{ ...validPayload.improvementPlan[0], week: 1.5 }],
      }),
    ).toThrow();
  });

  it('accepts passed=false with score below threshold', () => {
    const result = evalFeedbackSchema.parse({ ...validPayload, passed: false, overallScore: 65 });
    expect(result.passed).toBe(false);
  });

  it('requires at least an empty strengths array', () => {
    const result = evalFeedbackSchema.parse({ ...validPayload, strengths: [] });
    expect(result.strengths).toEqual([]);
  });

  it('detectedErrors timestamp is optional', () => {
    const withoutTimestamp = {
      ...validPayload,
      detectedErrors: [
        { type: 'grammar', original: 'I goes', correction: 'I go', explanation: 'Subject-verb agreement' },
      ],
    };
    expect(() => evalFeedbackSchema.parse(withoutTimestamp)).not.toThrow();
  });
});

describe('getLevelIndex', () => {
  it('A1 is index 0', () => {
    expect(getLevelIndex('A1')).toBe(0);
  });

  it('NATIVE is last', () => {
    expect(getLevelIndex('NATIVE')).toBeGreaterThan(getLevelIndex('C2'));
  });
});

describe('getNextLevel', () => {
  it('A1 → A2', () => {
    expect(getNextLevel('A1')).toBe('A2');
  });

  it('C2 → NATIVE', () => {
    expect(getNextLevel('C2')).toBe('NATIVE');
  });

  it('NATIVE → null', () => {
    expect(getNextLevel('NATIVE')).toBeNull();
  });
});
