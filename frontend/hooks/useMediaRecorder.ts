'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseMediaRecorderOptions {
  maxDurationMs?: number;
  mimeType?: string;
  onStop?: (blob: Blob, durationMs: number) => void;
  onError?: (error: Error) => void;
}

type RecorderState = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped';

export function useMediaRecorder({
  maxDurationMs = 10 * 60 * 1000,
  mimeType,
  onStop,
  onError,
}: UseMediaRecorderOptions = {}) {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(async (constraints: MediaStreamConstraints = { video: true, audio: true }) => {
    setState('requesting');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      const supportedType = mimeType && MediaRecorder.isTypeSupported(mimeType)
        ? mimeType
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : 'video/webm';

      const recorder = new MediaRecorder(mediaStream, { mimeType: supportedType });
      recorderRef.current = recorder;
      chunksRef.current = [];
      durationRef.current = 0;
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: supportedType });
        clearTimer();
        setState('stopped');
        onStop?.(blob, durationRef.current);
        mediaStream.getTracks().forEach((t) => t.stop());
        setStream(null);
      };

      recorder.start(1000);
      setState('recording');

      timerRef.current = setInterval(() => {
        durationRef.current += 1000;
        setDuration(durationRef.current);
        if (durationRef.current >= maxDurationMs) {
          recorder.stop();
        }
      }, 1000);
    } catch (err) {
      setState('idle');
      onError?.(err instanceof Error ? err : new Error('Failed to start recording'));
    }
  }, [mimeType, maxDurationMs, onStop, onError, clearTimer]);

  const stop = useCallback(() => {
    if (recorderRef.current && state === 'recording') {
      recorderRef.current.stop();
    }
  }, [state]);

  const pause = useCallback(() => {
    if (recorderRef.current && state === 'recording') {
      recorderRef.current.pause();
      clearTimer();
      setState('paused');
    }
  }, [state, clearTimer]);

  const resume = useCallback(() => {
    if (recorderRef.current && state === 'paused') {
      recorderRef.current.resume();
      setState('recording');
      timerRef.current = setInterval(() => {
        durationRef.current += 1000;
        setDuration(durationRef.current);
        if (durationRef.current >= maxDurationMs) stop();
      }, 1000);
    }
  }, [state, maxDurationMs, stop]);

  const reset = useCallback(() => {
    clearTimer();
    recorderRef.current = null;
    chunksRef.current = [];
    durationRef.current = 0;
    setDuration(0);
    setState('idle');
    setStream(null);
  }, [clearTimer]);

  // Without this, navigating away mid-recording (sidebar link, browser back)
  // left the camera/mic MediaStream running and the interval ticking on an
  // orphaned closure until it self-stopped at maxDurationMs.
  useEffect(() => {
    return () => {
      clearTimer();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop();
      }
      recorder?.stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    duration,
    stream,
    durationSeconds: Math.floor(duration / 1000),
    start,
    stop,
    pause,
    resume,
    reset,
    isRecording: state === 'recording',
    isIdle: state === 'idle',
  };
}
