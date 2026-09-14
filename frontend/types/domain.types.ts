export type LanguageCode = 'en' | 'fr' | 'pt' | 'es' | 'ja' | 'zh';
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'NATIVE';
export type LessonType = 'vocabulary' | 'grammar' | 'listening' | 'speaking' | 'reading' | 'writing';
export type ExerciseType = 'multiple_choice' | 'fill_blank' | 'flashcard' | 'speaking' | 'reorder';
export type SRSState = 'new' | 'learning' | 'review' | 'relearning';
export type ExamStatus = 'recording' | 'processing' | 'completed' | 'failed';
export type ActivityType = 'lesson' | 'srs' | 'speaking' | 'listening' | 'writing' | 'exam';

// ── User & Auth ──────────────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  display_name?: string;
  native_language: string;
  learning_goals: string[];
  avatar_url: string | null;
  timezone?: string;
  daily_goal_minutes: number;
  active_days: number[];
  onboarding_completed: boolean;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  streak_freezes: number;
  created_at: string;
  updated_at: string;
}

// ── Enrollment ───────────────────────────────────────────
export interface Enrollment {
  id: string;
  user_id: string;
  language_code: LanguageCode;
  current_level: CEFRLevel;
  active: boolean;
  total_study_hours: number;
  xp_total: number;
  daily_goal_minutes: number;
  started_at: string;
  diagnostic_completed: boolean;
  exam_attempts_count: number;
  created_at: string;
  updated_at: string;
}

export interface EnrollmentStats {
  total_study_hours: number;
  srs_cards_due: number;
  lessons_completed: number;
  exam_attempts: number;
  current_streak: number;
}

// ── Activity ─────────────────────────────────────────────
export interface ActivityLog {
  id: string;
  user_id: string;
  enrollment_id: string;
  activity_type: ActivityType;
  duration_minutes: number;
  xp_earned: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ── Lessons ──────────────────────────────────────────────
export interface Lesson {
  id: string;
  language_code: LanguageCode;
  level: CEFRLevel;
  lesson_type: LessonType;
  title: string;
  description: string | null;
  order_index: number;
  estimated_minutes: number;
  exercise_count: number;
  created_at: string;
}

export interface Exercise {
  id: string;
  lesson_id: string;
  type: ExerciseType;
  question: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
  order_index: number;
}

export interface LessonProgress {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  completed: boolean;
  score: number | null;
  time_spent_seconds: number;
  completed_at: string | null;
}

// ── SRS ──────────────────────────────────────────────────
export interface SRSItem {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  vocabulary_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  total_reviews: number;
}

export type SRSRating = 0 | 1 | 2 | 3 | 4 | 5;

// ── Exam ─────────────────────────────────────────────────
export interface ExamAttempt {
  id: string;
  user_id: string;
  enrollment_id: string;
  status: ExamStatus;
  video_url: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  overall_score: number | null;
  passed: boolean | null;
  ai_feedback: Record<string, unknown> | null;
  submitted_at: string | null;
  evaluated_at: string | null;
  created_at: string;
}

export interface DimensionScores {
  fluency: number;
  pronunciation: number;
  grammar: number;
  vocabulary: number;
  coherence: number;
}

export interface DetectedError {
  type: string;
  original: string;
  correction: string;
  explanation: string;
  timestamp?: number;
}

export interface ImprovementTask {
  week: number;
  task: string;
  resources: string[];
  estimatedMinutes: number;
}

export interface AIFeedback {
  overall_score: number;
  passed: boolean;
  dimension_scores: DimensionScores;
  strengths: string[];
  weaknesses: string[];
  detected_errors: DetectedError[];
  improvement_plan: ImprovementTask[];
  feedback_summary: string;
  transcript?: string;
}

export interface ExamEligibility {
  eligible: boolean;
  reasons: string[];
  hoursStudied: number;
  requiredHours: number;
  monthsStudied: number;
  requiredMonths: number;
  lastAttemptDate: string | null;
  cooldownDaysRemaining: number;
}

// ── Gamification ─────────────────────────────────────────
export interface Streak {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  atRisk: boolean;
  freezesAvailable: number;
}

// ── Level Config ─────────────────────────────────────────
export interface LevelConfig {
  label: string;
  min_months: number;
  min_hours: number;
  daily_hours_required: number;
  min_score_to_pass: number;
  exam_duration_minutes: number;
  vocabulary_target: number;
  next_level: CEFRLevel | null;
  color: string;
  description: string;
}

export type LevelsConfig = Record<CEFRLevel, LevelConfig>;

// ── Language Config ──────────────────────────────────────
export interface LanguageConfig {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  script: 'latin' | 'cjk' | 'kana';
  hasTones: boolean;
  hasKanji: boolean;
  fontClass: string;
  description: string;
}

// ── Evaluation SSE events ─────────────────────────────────
export type EvalStep =
  | 'transcribing'
  | 'analyzing_fluency'
  | 'analyzing_pronunciation'
  | 'analyzing_grammar'
  | 'analyzing_vocabulary'
  | 'analyzing_coherence'
  | 'generating_plan'
  | 'finalizing';

export interface EvalEvent {
  type: 'step' | 'complete' | 'error';
  step?: EvalStep;
  message?: string;
  data?: Record<string, unknown>;
}
