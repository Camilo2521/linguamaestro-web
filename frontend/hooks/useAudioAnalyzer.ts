'use client';

import { useRef, useCallback, useState } from 'react';

interface AudioAnalyzerResult {
  volume: number;
  isSpeaking: boolean;
  bars: number[];
}

export function useAudioAnalyzer(stream: MediaStream | null, barCount = 32) {
  const [analysis, setAnalysis] = useState<AudioAnalyzerResult>({ volume: 0, isSpeaking: false, bars: Array(barCount).fill(0) });
  const contextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataRef = useRef<Uint8Array<any> | null>(null);

  const start = useCallback(() => {
    if (!stream) return;

    contextRef.current = new AudioContext();
    const analyzer = contextRef.current.createAnalyser();
    analyzer.fftSize = 256;
    analyzerRef.current = analyzer;
    dataRef.current = new Uint8Array(analyzer.frequencyBinCount);

    const source = contextRef.current.createMediaStreamSource(stream);
    source.connect(analyzer);

    const tick = () => {
      if (!analyzerRef.current || !dataRef.current) return;
      analyzerRef.current.getByteFrequencyData(dataRef.current);

      const sliceWidth = Math.floor(dataRef.current.length / barCount);
      const bars = Array.from({ length: barCount }, (_, i) => {
        const slice = dataRef.current!.slice(i * sliceWidth, (i + 1) * sliceWidth);
        const avg = slice.reduce((s, v) => s + v, 0) / slice.length;
        return avg / 255;
      });

      const volume = bars.reduce((s, v) => s + v, 0) / bars.length;
      setAnalysis({ volume, isSpeaking: volume > 0.05, bars });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [stream, barCount]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    contextRef.current?.close();
    contextRef.current = null;
    analyzerRef.current = null;
    setAnalysis({ volume: 0, isSpeaking: false, bars: Array(barCount).fill(0) });
  }, [barCount]);

  return { ...analysis, start, stop };
}
