import { http, HttpResponse } from 'msw';

const BASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'http://localhost:54321';

const mockFeedback = {
  overall_score: 0.82,
  passed: true,
  dimension_scores: {
    fluency: 0.85,
    pronunciation: 0.78,
    grammar: 0.80,
    vocabulary: 0.88,
    coherence: 0.79,
  },
  strengths: ['Vocabulario amplio', 'Buena fluidez'],
  weaknesses: ['Pronunciación de vocales largas'],
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
      task: 'Práctica de pronunciación con minimal pairs',
      resources: ['Forvo', 'BBC Pronunciation'],
      estimatedMinutes: 20,
    },
  ],
  feedback_summary: 'Muy buen desempeño general. Trabaja la pronunciación de consonantes finales.',
  transcript: 'I think that technology has changed the way we communicate significantly...',
};

export const aiEvaluatorHandlers = [
  // SSE evaluation stream
  http.post(`${BASE_URL}/functions/v1/evaluate-exam`, () => {
    const steps = ['transcribing', 'analyzing_fluency', 'analyzing_grammar', 'finalizing'];
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        let i = 0;
        const interval = setInterval(() => {
          if (i < steps.length) {
            const event = JSON.stringify({ type: 'step', step: steps[i] });
            controller.enqueue(encoder.encode(`data: ${event}\n\n`));
            i++;
          } else {
            const done = JSON.stringify({ type: 'complete', data: mockFeedback });
            controller.enqueue(encoder.encode(`data: ${done}\n\n`));
            clearInterval(interval);
            controller.close();
          }
        }, 10);
      },
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  }),

  // Direct feedback fetch (non-streaming)
  http.get(`${BASE_URL}/functions/v1/get-exam-feedback`, () => {
    return HttpResponse.json(mockFeedback);
  }),
];
