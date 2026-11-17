'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Mic2, Volume2, MessageSquare, PenLine, CheckSquare, Edit3, Play, Clock, Trophy, Shuffle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/input';
import { MultipleChoice } from '@/components/learning/MultipleChoice';
import { FillBlank } from '@/components/learning/FillBlank';
import { useActiveEnrollment } from '@/stores/session.store';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { practiceApi } from '@/lib/api/practice';
import { useToast } from '@/stores/ui.store';
import { cn } from '@/lib/utils/cn';
import { levenshteinSimilarity } from '@/lib/utils/text-similarity';
import type { LanguageCode, PracticeMode, PracticePrompt } from '@/types/domain.types';

const MODES: { id: PracticeMode; icon: typeof Mic; label: string; desc: string; color: string }[] = [
  { id: 'speaking', icon: Mic, label: 'Práctica libre', desc: 'Habla sobre un tema dado, a tu ritmo.', color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
  { id: 'shadowing', icon: Volume2, label: 'Shadowing', desc: 'Repite textos nativos para mejorar tu pronunciación.', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  { id: 'debate', icon: MessageSquare, label: 'Debate', desc: 'Argumenta a favor y en contra de un tema.', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'writing', icon: PenLine, label: 'Escritura', desc: 'Redacta en el idioma que estás aprendiendo.', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'multiple_choice', icon: CheckSquare, label: 'Preguntas', desc: 'Opción múltiple sobre gramática y vocabulario.', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  { id: 'fill_blank', icon: Edit3, label: 'Completar', desc: 'Rellena la palabra que falta en la oración.', color: 'text-pink-400 bg-pink-500/10 border-pink-500/30' },
  { id: 'pronunciation', icon: Mic2, label: 'Pronunciación', desc: 'Di la frase en voz alta y recibe retroalimentación real.', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
];

const TIPS: Record<PracticeMode, string[]> = {
  speaking: [
    'Habla sin parar al menos el tiempo sugerido — la fluidez primero',
    'No te preocupes por los errores, corrígelos sobre la marcha',
    'Graba tus sesiones para escucharte después',
  ],
  shadowing: [
    'Escucha primero el ritmo completo de la frase antes de repetirla',
    'Exagera un poco la entonación — ayuda a fijar la pronunciación',
    'Repite la misma frase varias veces si lo necesitas',
  ],
  debate: [
    'Defiende primero una postura y luego la contraria',
    'Usa conectores (sin embargo, por otro lado, además) para sonar más natural',
    'Justifica cada afirmación con un ejemplo concreto',
  ],
  writing: [
    'Escribe primero sin detenerte a corregir — revisa al final',
    'Varía el vocabulario en lugar de repetir las mismas palabras',
    'Relee en voz alta lo que escribiste para detectar frases que no fluyen',
  ],
  multiple_choice: [
    'Lee las 4 opciones completas antes de elegir — descarta las imposibles primero',
    'Si dudas entre dos, piensa en una oración de ejemplo para cada una',
    'Equivocarte también cuenta como práctica — revisa la explicación',
  ],
  fill_blank: [
    'Lee toda la oración antes de escribir — el contexto te da la respuesta',
    'Se acepta una ortografía casi exacta, no necesitas ser perfecto',
    'Piensa en la función gramatical de la palabra que falta (verbo, sustantivo...)',
  ],
  pronunciation: [
    'Habla claro y a un volumen normal, cerca del micrófono',
    'No te preocupes por el acento — el reconocimiento tolera variaciones',
    'Si el navegador no te entiende, intenta separar un poco más las palabras',
  ],
};

const SPEECH_LANG: Record<LanguageCode, string> = {
  en: 'en-US', fr: 'fr-FR', pt: 'pt-BR', es: 'es-ES', ja: 'ja-JP', zh: 'zh-CN',
};

interface OralSession {
  kind: 'oral';
  prompt: PracticePrompt;
  startTime: number;
  elapsedSeconds: number;
}

interface WritingSession {
  kind: 'writing';
  prompt: PracticePrompt;
  startTime: number;
  text: string;
}

interface QuizSession {
  kind: 'quiz';
  prompt: PracticePrompt;
  startTime: number;
  answered: boolean;
  correct: boolean | null;
}

interface PronunciationSession {
  kind: 'pronunciation';
  prompt: PracticePrompt;
  startTime: number;
  elapsedSeconds: number;
}

type Session = OralSession | WritingSession | QuizSession | PronunciationSession;

function wordCount(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

export default function PracticePage() {
  const enrollment = useActiveEnrollment();
  const { error: toastError, success: toastSuccess } = useToast();

  const [activeMode, setActiveMode] = useState<PracticeMode | null>(null);
  const [pool, setPool] = useState<PracticePrompt[]>([]);
  const [loadingMode, setLoadingMode] = useState<PracticeMode | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [timerRef, setTimerRef] = useState<ReturnType<typeof setInterval> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const level = enrollment?.current_level ?? 'A1';
  const speechLang = SPEECH_LANG[enrollment?.language_code ?? 'en'];
  const speech = useSpeechRecognition({ lang: speechLang });

  function pickPrompt(items: PracticePrompt[], excludeId?: string): PracticePrompt {
    const candidates = items.length > 1 ? items.filter((p) => p.id !== excludeId) : items;
    return candidates[Math.floor(Math.random() * candidates.length)]!;
  }

  async function startMode(mode: PracticeMode) {
    if (!enrollment) return;
    setLoadingMode(mode);
    try {
      const res = await practiceApi.list(enrollment.language_code, level, mode);
      const items = res.data;
      if (!items || items.length === 0) {
        toastError('Aún no hay ejercicios de este tipo para tu idioma y nivel.');
        return;
      }
      setPool(items);
      setActiveMode(mode);
      launchPrompt(mode, pickPrompt(items));
    } catch {
      toastError('No se pudieron cargar los ejercicios. Intenta de nuevo.');
    } finally {
      setLoadingMode(null);
    }
  }

  function launchPrompt(mode: PracticeMode, prompt: PracticePrompt) {
    if (timerRef) clearInterval(timerRef);
    speech.reset();
    const startTime = Date.now();

    if (mode === 'writing') {
      setSession({ kind: 'writing', prompt, startTime, text: '' });
      setTimerRef(null);
      return;
    }
    if (mode === 'multiple_choice' || mode === 'fill_blank') {
      setSession({ kind: 'quiz', prompt, startTime, answered: false, correct: null });
      setTimerRef(null);
      return;
    }

    const kind = mode === 'pronunciation' ? 'pronunciation' : 'oral';
    setSession({ kind, prompt, startTime, elapsedSeconds: 0 } as Session);
    const interval = setInterval(() => {
      setSession((s) =>
        s && (s.kind === 'oral' || s.kind === 'pronunciation') ? { ...s, elapsedSeconds: Math.floor((Date.now() - s.startTime) / 1000) } : s,
      );
    }, 1000);
    setTimerRef(interval);
  }

  function shufflePrompt() {
    if (!activeMode || pool.length === 0 || !session) return;
    launchPrompt(activeMode, pickPrompt(pool, session.prompt.id));
  }

  function exitSession() {
    if (timerRef) clearInterval(timerRef);
    if (speech.isListening) speech.stop();
    setTimerRef(null);
    setSession(null);
    setActiveMode(null);
    setPool([]);
  }

  async function submitComplete(extra: { wordCount?: number; answer?: string; transcript?: string }) {
    if (!session || !enrollment) return null;
    const durationSeconds = Math.floor((Date.now() - session.startTime) / 1000);
    return practiceApi.complete(session.prompt.id, enrollment.id, durationSeconds, extra);
  }

  // multiple_choice / fill_blank answer instantly instead of waiting on a
  // "Finalizar sesión" button — a single question is graded the moment it's
  // answered, the same way Learn's lesson exercises work.
  async function handleQuizAnswer(answer: string, locallyCorrect: boolean) {
    if (!session || session.kind !== 'quiz' || submitting) return;
    setSubmitting(true);
    try {
      const result = await submitComplete({ answer });
      if (result?.success) {
        setSession({ ...session, answered: true, correct: result.data?.correct ?? locallyCorrect });
        if (result.data?.correct) toastSuccess(`¡Correcto! +${result.data.xpEarned} XP`);
      } else {
        toastError(result?.error ?? 'No se pudo guardar la respuesta.');
      }
    } catch (err: any) {
      toastError(err?.message ?? 'No se pudo guardar la respuesta.');
    } finally {
      setSubmitting(false);
    }
  }

  async function finishSession() {
    if (!session || submitting) return;
    setSubmitting(true);
    try {
      const words = session.kind === 'writing' ? wordCount(session.text) : undefined;
      const transcript = session.kind === 'pronunciation' ? speech.transcript : undefined;
      const result = await submitComplete({ wordCount: words, transcript });
      if (result?.success) {
        if (session.kind === 'pronunciation' && result.data?.correct === false) {
          toastError('No sonó lo bastante parecido — inténtalo de nuevo.');
        } else {
          toastSuccess(`¡Sesión guardada! +${result.data?.xpEarned ?? 0} XP`);
          exitSession();
        }
      } else {
        toastError(result?.error ?? 'No se pudo guardar la sesión.');
      }
    } catch (err: any) {
      toastError(err?.message ?? 'No se pudo guardar la sesión (revisa tu conexión o límite diario).');
    } finally {
      setSubmitting(false);
    }
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  const activeModeConfig = MODES.find((m) => m.id === activeMode);
  const minWords = session?.kind === 'writing' ? Math.max(5, Math.round((session.prompt.target_words ?? 30) * 0.5)) : 0;
  const currentWords = session?.kind === 'writing' ? wordCount(session.text) : 0;
  const oralTargetSeconds = session?.kind === 'oral' || session?.kind === 'pronunciation' ? session.prompt.target_seconds ?? 90 : 0;
  const pronunciationMatch = session?.kind === 'pronunciation' && speech.transcript && session.prompt.reference_text
    ? levenshteinSimilarity(speech.transcript.toLowerCase(), session.prompt.reference_text.toLowerCase()) >= 0.7
    : null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Práctica</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Nivel {level} · Refuerza tu expresión oral y escrita
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!session ? (
          <motion.div key="modes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {MODES.map(({ id, icon: Icon, label, desc, color }) => (
              <button
                key={id}
                onClick={() => startMode(id)}
                disabled={loadingMode !== null}
                className="w-full flex items-center gap-4 p-5 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-strong)] transition-all group text-left disabled:opacity-60"
              >
                <div className={cn('p-3 rounded-[var(--radius-xl)] border', color)}>
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[var(--color-text-primary)]">{label}</p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{desc}</p>
                </div>
                {loadingMode === id ? (
                  <span className="text-xs text-[var(--color-text-muted)]">Cargando…</span>
                ) : (
                  <Play size={16} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors" />
                )}
              </button>
            ))}

            <Card className="mt-4">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Trophy size={14} className="text-[var(--color-accent-gold)]" /> Consejos generales</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {[
                  'Practica varios modos a lo largo de la semana para un progreso más parejo',
                  'La constancia en sesiones cortas vence a una sesión larga ocasional',
                  'Repite un ejercicio que te costó — la repetición fija el aprendizaje',
                ].map((tip) => (
                  <p key={tip} className="text-xs text-[var(--color-text-secondary)] flex items-start gap-2">
                    <span className="text-[var(--color-accent-primary)] shrink-0">→</span>
                    {tip}
                  </p>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="session" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="primary">{activeModeConfig?.label}</Badge>
                <button onClick={shufflePrompt} title="Cambiar ejercicio" className="p-1.5 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors">
                  <Shuffle size={14} />
                </button>
              </div>
              {(session.kind === 'oral' || session.kind === 'pronunciation') && (
                <div className="flex items-center gap-2 text-sm font-mono text-[var(--color-text-secondary)]">
                  <Clock size={14} />
                  <span className={session.elapsedSeconds >= oralTargetSeconds ? 'text-emerald-400 font-bold' : ''}>
                    {formatTime(session.elapsedSeconds)}
                  </span>
                </div>
              )}
              {session.kind === 'writing' && (
                <span className={cn('text-sm font-mono', currentWords >= minWords ? 'text-emerald-400 font-bold' : 'text-[var(--color-text-secondary)]')}>
                  {currentWords} / {session.prompt.target_words ?? 30} palabras
                </span>
              )}
            </div>

            {session.kind !== 'quiz' && (
              <Card variant="glass" className="p-6">
                <p className="text-xs text-[var(--color-text-muted)] mb-3">
                  {activeMode === 'shadowing' ? 'Lee en voz alta, imitando la pronunciación:'
                    : activeMode === 'pronunciation' ? 'Pronuncia esta frase en voz alta:'
                    : activeMode === 'writing' ? 'Redacta sobre este tema:' : 'Habla sobre este tema:'}
                </p>
                <p className="text-base font-medium text-[var(--color-text-primary)] leading-relaxed">
                  {session.prompt.prompt}
                </p>
                {(activeMode === 'shadowing' || activeMode === 'pronunciation') && session.prompt.reference_text && (
                  <div className="mt-4 pt-4 border-t border-[var(--color-border-default)]">
                    <p className="text-lg font-semibold text-[var(--color-accent-primary)] leading-relaxed">
                      "{session.prompt.reference_text}"
                    </p>
                    {session.prompt.source && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-2">— {session.prompt.source}</p>
                    )}
                  </div>
                )}
              </Card>
            )}

            {session.kind === 'oral' && activeMode === 'speaking' && (
              <div className="flex flex-col items-center gap-3 py-6">
                <motion.div
                  animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center"
                >
                  <Mic size={24} className="text-red-400" />
                </motion.div>
                <p className="text-xs text-[var(--color-text-muted)]">Grabando… habla con confianza</p>
              </div>
            )}

            {session.kind === 'oral' && session.elapsedSeconds >= oralTargetSeconds && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs text-emerald-400 font-medium">
                ✓ Mínimo sugerido completado ({Math.round(oralTargetSeconds / 60) || 1} min) — puedes continuar o finalizar
              </motion.p>
            )}

            {session.kind === 'writing' && (
              <Textarea
                autoFocus
                value={session.text}
                onChange={(e) => setSession({ ...session, text: e.target.value })}
                placeholder="Empieza a escribir aquí…"
                className="min-h-[220px] text-base leading-relaxed"
              />
            )}

            {session.kind === 'quiz' && activeMode === 'multiple_choice' && (
              <MultipleChoice
                question={session.prompt.prompt}
                options={session.prompt.options ?? []}
                correctAnswer={session.prompt.correct_answer ?? ''}
                showFeedback={session.answered}
                onAnswer={(answer) => handleQuizAnswer(answer, answer === session.prompt.correct_answer)}
              />
            )}

            {session.kind === 'quiz' && activeMode === 'fill_blank' && (
              <FillBlank
                question={session.prompt.prompt}
                correctAnswer={session.prompt.correct_answer ?? ''}
                showFeedback={session.answered}
                onAnswer={(answer, correct) => handleQuizAnswer(answer, correct)}
              />
            )}

            {session.kind === 'pronunciation' && (
              <div className="flex flex-col items-center gap-4 py-4">
                {!speech.isSupported ? (
                  <p className="text-xs text-[var(--color-danger)] text-center px-6">
                    Tu navegador no soporta reconocimiento de voz. Prueba con Chrome o Edge en una computadora.
                  </p>
                ) : (
                  <>
                    <button
                      onClick={() => (speech.isListening ? speech.stop() : speech.start())}
                      className={cn(
                        'w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all',
                        speech.isListening
                          ? 'bg-red-500/20 border-red-500/50 animate-pulse'
                          : 'bg-[var(--color-accent-primary)]/10 border-[var(--color-accent-primary)]/40 hover:bg-[var(--color-accent-primary)]/15',
                      )}
                    >
                      <Mic2 size={24} className={speech.isListening ? 'text-red-400' : 'text-[var(--color-accent-primary)]'} />
                    </button>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {speech.isListening ? 'Escuchando… toca para detener' : 'Toca el micrófono y pronuncia la frase'}
                    </p>
                    {speech.error && <p className="text-xs text-[var(--color-danger)]">{speech.error}</p>}
                    {speech.transcript && (
                      <div className={cn(
                        'w-full p-3 rounded-[var(--radius-lg)] border text-center text-sm',
                        pronunciationMatch ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]',
                      )}>
                        {speech.transcript}
                        {pronunciationMatch !== null && (
                          <p className="text-xs mt-1 font-semibold">{pronunciationMatch ? '✓ Suena muy parecido' : '✗ Intenta de nuevo, no coincide del todo'}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {session.kind === 'quiz' ? (
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={exitSession}>Salir</Button>
                <Button className="flex-1" onClick={shufflePrompt} disabled={!session.answered}>
                  Siguiente ejercicio →
                </Button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={exitSession} disabled={submitting}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={finishSession}
                  loading={submitting}
                  disabled={(session.kind === 'writing' && currentWords < minWords) || (session.kind === 'pronunciation' && !speech.transcript)}
                >
                  {session.kind === 'writing' && currentWords < minWords
                    ? `Escribe ${minWords - currentWords} palabras más`
                    : '⏹ Finalizar sesión'}
                </Button>
              </div>
            )}

            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Trophy size={14} className="text-[var(--color-accent-gold)]" /> Consejos para {activeModeConfig?.label.toLowerCase()}</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {TIPS[activeMode!].map((tip) => (
                  <p key={tip} className="text-xs text-[var(--color-text-secondary)] flex items-start gap-2">
                    <span className="text-[var(--color-accent-primary)] shrink-0">→</span>
                    {tip}
                  </p>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
