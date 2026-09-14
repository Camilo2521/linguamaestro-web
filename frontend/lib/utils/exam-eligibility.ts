export const LEVEL_REQUIREMENTS: Record<string, { min_hours: number; min_months: number }> = {
  A1: { min_hours: 90, min_months: 3 },
  A2: { min_hours: 180, min_months: 4 },
  B1: { min_hours: 300, min_months: 5 },
  B2: { min_hours: 400, min_months: 5 },
  C1: { min_hours: 540, min_months: 6 },
  C2: { min_hours: 540, min_months: 6 },
};

export const EXAM_COOLDOWN_DAYS = 7;

export interface EligibilityInput {
  currentLevel: string;
  hoursStudied: number;
  startedAt: string;
  lastAttemptDate?: string | null;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  hoursStudied: number;
  requiredHours: number;
  monthsStudied: number;
  requiredMonths: number;
  cooldownDaysRemaining: number;
}

export function computeEligibility(input: EligibilityInput, now = new Date()): EligibilityResult {
  const req = LEVEL_REQUIREMENTS[input.currentLevel] ?? { min_hours: 90, min_months: 3 };
  const monthsStudied = (now.getTime() - new Date(input.startedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  const hoursStudied = input.hoursStudied;

  const daysSinceLast = input.lastAttemptDate
    ? (now.getTime() - new Date(input.lastAttemptDate).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  const reasons: string[] = [];
  if (hoursStudied < req.min_hours) {
    reasons.push(`Necesitas ${req.min_hours}h de estudio (tienes ${Math.round(hoursStudied)}h)`);
  }
  if (monthsStudied < req.min_months) {
    reasons.push(`Necesitas ${req.min_months} meses de estudio`);
  }
  if (daysSinceLast < EXAM_COOLDOWN_DAYS) {
    reasons.push(`Debes esperar ${EXAM_COOLDOWN_DAYS - Math.floor(daysSinceLast)} días más`);
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    hoursStudied,
    requiredHours: req.min_hours,
    monthsStudied: Math.round(monthsStudied * 10) / 10,
    requiredMonths: req.min_months,
    cooldownDaysRemaining:
      daysSinceLast < EXAM_COOLDOWN_DAYS ? Math.ceil(EXAM_COOLDOWN_DAYS - daysSinceLast) : 0,
  };
}
