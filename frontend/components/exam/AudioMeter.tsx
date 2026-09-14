'use client';

import { useEffect } from 'react';
import { useAudioAnalyzer } from '@/hooks/useAudioAnalyzer';

interface AudioMeterProps {
  stream: MediaStream | null;
  barCount?: number;
  height?: number;
}

export function AudioMeter({ stream, barCount = 24, height = 40 }: AudioMeterProps) {
  const { bars, isSpeaking, start, stop } = useAudioAnalyzer(stream, barCount);

  useEffect(() => {
    if (stream) start();
    return () => stop();
  }, [stream, start, stop]);

  return (
    <div
      className="flex items-end justify-center gap-0.5"
      style={{ height }}
      aria-label={isSpeaking ? 'Hablando' : 'Silencio'}
    >
      {bars.map((v, i) => (
        <div
          key={i}
          className="w-1 rounded-full transition-all duration-75"
          style={{
            height: `${Math.max(4, v * height)}px`,
            background: isSpeaking
              ? `hsl(${220 + v * 40}, 80%, ${50 + v * 20}%)`
              : 'var(--color-border-strong)',
          }}
        />
      ))}
    </div>
  );
}
