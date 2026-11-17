'use client';

import { useCallback, useRef, useState } from 'react';

// The Web Speech API has no official TS lib entry yet (and ships under a
// vendor prefix in Chrome/Edge) — this is the one place in the app that
// reaches for `any` to talk to it; everything downstream of this hook is
// fully typed.
interface UseSpeechRecognitionOptions {
  /** BCP-47 locale, e.g. 'en-US', 'ja-JP'. */
  lang: string;
}

export function useSpeechRecognition({ lang }: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const getCtor = () =>
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
      : null;

  const isSupported = typeof window !== 'undefined' && !!getCtor();

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError('Tu navegador no soporta reconocimiento de voz. Prueba con Chrome o Edge.');
      return;
    }
    if (recognitionRef.current) return; // already listening

    setError(null);
    setTranscript('');

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setTranscript((finalText || interimText).trim());
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') setError('No se detectó voz. Intenta de nuevo.');
      else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setError('Permiso de micrófono denegado.');
      else setError('Error al reconocer la voz. Intenta de nuevo.');
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return { isSupported, isListening, transcript, error, start, stop, reset };
}
