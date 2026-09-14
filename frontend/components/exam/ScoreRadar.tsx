'use client';

import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import type { DimensionScores } from '@/types/domain.types';

interface ScoreRadarProps {
  scores: DimensionScores;
  minScore?: number;
}

const LABELS: Record<keyof DimensionScores, string> = {
  fluency: 'Fluidez',
  pronunciation: 'Pronunciación',
  grammar: 'Gramática',
  vocabulary: 'Vocabulario',
  coherence: 'Coherencia',
};

export function ScoreRadar({ scores, minScore = 0.75 }: ScoreRadarProps) {
  const data = (Object.keys(LABELS) as (keyof DimensionScores)[]).map((key) => ({
    dimension: LABELS[key],
    score: Math.round((scores[key] ?? 0) * 100),
    min: Math.round(minScore * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="var(--color-border-default)" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fill: 'var(--color-text-secondary)', fontSize: 11, fontWeight: 500 }}
        />
        <Tooltip
          contentStyle={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 12 }}
          formatter={(v: number) => [`${v}%`, '']}
        />
        <Radar
          name="Tu puntuación"
          dataKey="score"
          stroke="var(--color-accent-primary)"
          fill="var(--color-accent-primary)"
          fillOpacity={0.25}
          strokeWidth={2}
        />
        <Radar
          name="Mínimo"
          dataKey="min"
          stroke="rgba(239,68,68,0.6)"
          fill="rgba(239,68,68,0.05)"
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
