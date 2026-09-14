'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Volume2, MessageSquare, Play, Clock, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useActiveEnrollment } from '@/stores/session.store';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { useToast } from '@/stores/ui.store';
import { cn } from '@/lib/utils/cn';

const SPEAKING_PROMPTS: Record<string, string[]> = {
  A1: [
    'Describe tu rutina diaria en 2 minutos.',
    'Habla sobre tu familia y tu casa.',
    'Di 10 cosas que puedes ver en tu habitación.',
  ],
  A2: [
    'Habla sobre tus hobbies y por qué te gustan.',
    'Describe tu ciudad: ¿qué hay que ver y hacer?',
    'Cuéntame sobre tu trabajo o tus estudios.',
  ],
  B1: [
    'Habla sobre un viaje que hiciste o que quieres hacer.',
    'Describe una película o libro que te gustó mucho.',
    '¿Cuáles son los problemas más importantes de tu ciudad?',
  ],
  B2: [
    '¿Cuáles son los pros y contras del trabajo remoto?',
    'Habla sobre el impacto de las redes sociales en la sociedad.',
    'Compara la vida urbana con la vida rural.',
  ],
  C1: [
    'Analiza las causas y consecuencias del cambio climático.',
    'Discute el papel de la inteligencia artificial en la educación.',
    '¿Qué cambios sociales han traído las últimas generaciones?',
  ],
  C2: [
    'Elabora un argumento sobre la globalización y la identidad cultural.',
    'Discute las implicaciones éticas de la manipulación genética.',
    '¿Qué tan libre es realmente la prensa en el mundo contemporáneo?',
  ],
};

const SHADOWING_TEXTS: Record<string, { text: string; source: string }[]> = {
  A1: [
    { text: 'Hello, my name is Maria. I am from Spain. I am 25 years old. I am a teacher.', source: 'Basic Introduction' },
    { text: 'I wake up at 7 o\'clock. I have breakfast and go to work. I come home at 6 PM.', source: 'Daily Routine' },
  ],
  B1: [
    { text: 'Technology has changed the way we communicate. We can now talk to people around the world instantly.', source: 'Tech & Society' },
    { text: 'Learning a new language opens doors to new cultures and opportunities that you never imagined possible.', source: 'Language Learning' },
  ],
  C1: [
    { text: 'The paradox of choice suggests that having too many options can actually lead to less satisfaction and more anxiety.', source: 'Psychology Today' },
    { text: 'Artificial intelligence is not merely a tool — it is reshaping the fundamental fabric of human cognition and society.', source: 'Academic Review' },
  ],
};

type Mode = 'speaking' | 'shadowing' | 'debate';

interface SessionState {
  active: boolean;
  prompt: string;
  startTime: number;
  elapsedSeconds: number;
}

export default function PracticePage() {
  const enrollment = useActiveEnrollment();
  const [activeMode, setActiveMode] = useState<Mode | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [timerRef, setTimerRef] = useState<ReturnType<typeof setInterval> | null>(null);
  const { start: startTracking, stop: stopTracking } = useActivityTracker({
    activityType: 'speaking',
    xpPerMinute: 12,
  });
  const { error: toastError, success: toastSuccess } = useToast();

  const level = enrollment?.current_level ?? 'A1';
  const prompts = SPEAKING_PROMPTS[level] ?? SPEAKING_PROMPTS['A1']!;
  const shadowingTexts = SHADOWING_TEXTS[level in SHADOWING_TEXTS ? level : 'B1'] ?? SHADOWING_TEXTS['B1']!;

  function startSession(mode: Mode) {
    const prompt = mode === 'shadowing'
      ? shadowingTexts[Math.floor(Math.random() * shadowingTexts.length)]!.text
      : prompts[Math.floor(Math.random() * prompts.length)]!;

    setActiveMode(mode);
    setSession({ active: true, prompt, startTime: Date.now(), elapsedSeconds: 0 });
    startTracking();

    const interval = setInterval(() => {
      setSession((s) => s ? { ...s, elapsedSeconds: Math.floor((Date.now() - s.startTime) / 1000) } : null);
    }, 1000);
    setTimerRef(interval);
  }

  async function endSession() {
    if (timerRef) clearInterval(timerRef);
    setTimerRef(null);
    const saved = await stopTracking();
    if (saved) {
      toastSuccess('Sesión guardada');
    } else {
      toastError('No se pudo guardar la sesión (revisa tu límite diario o conexión)');
    }
    setSession(null);
    setActiveMode(null);
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  const MODES = [
    { id: 'speaking' as Mode, icon: Mic, label: 'Práctica libre', desc: 'Habla sobre un tema dado. IA evalúa tu respuesta.', color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
    { id: 'shadowing' as Mode, icon: Volume2, label: 'Shadowing', desc: 'Repite textos nativos para mejorar tu pronunciación.', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
    { id: 'debate' as Mode, icon: MessageSquare, label: 'Debate', desc: 'Argumenta a favor y en contra de un tema.', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  ];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Práctica oral</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Nivel {level} · Mejora tu expresión y fluidez
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!session ? (
          <motion.div key="modes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {MODES.map(({ id, icon: Icon, label, desc, color }) => (
              <button
                key={id}
                onClick={() => startSession(id)}
                className="w-full flex items-center gap-4 p-5 rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-strong)] transition-all group text-left"
              >
                <div className={cn('p-3 rounded-[var(--radius-xl)] border', color)}>
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[var(--color-text-primary)]">{label}</p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{desc}</p>
                </div>
                <Play size={16} className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors" />
              </button>
            ))}

            <Card className="mt-4">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Trophy size={14} className="text-[var(--color-accent-gold)]" /> Consejos para esta sesión</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {[
                  'Habla sin parar al menos 2 minutos seguidos',
                  'No te preocupes por los errores — la fluidez primero',
                  'Graba tus sesiones para escucharte después',
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
              <Badge variant="primary">{MODES.find((m) => m.id === activeMode)?.label}</Badge>
              <div className="flex items-center gap-2 text-sm font-mono text-[var(--color-text-secondary)]">
                <Clock size={14} />
                <span className={session.elapsedSeconds >= 120 ? 'text-emerald-400 font-bold' : ''}>{formatTime(session.elapsedSeconds)}</span>
              </div>
            </div>

            <Card variant="glass" className="p-6">
              <p className="text-xs text-[var(--color-text-muted)] mb-3">
                {activeMode === 'shadowing' ? 'Lee en voz alta:' : 'Habla sobre este tema:'}
              </p>
              <p className="text-base font-medium text-[var(--color-text-primary)] leading-relaxed">
                {session.prompt}
              </p>
            </Card>

            {activeMode === 'speaking' && (
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

            {session.elapsedSeconds >= 120 && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs text-emerald-400 font-medium">
                ✓ Mínimo completado (2 min) — puedes continuar o finalizar
              </motion.p>
            )}

            <Button variant="danger" className="w-full" onClick={endSession}>
              ⏹ Finalizar sesión
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
