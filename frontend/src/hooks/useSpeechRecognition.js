import { useCallback, useEffect, useRef, useState } from 'react';

const SpeechRecognitionApi =
  typeof window === 'undefined' ? null : window.SpeechRecognition ?? window.webkitSpeechRecognition;

const ERRORS = {
  'not-allowed': 'Microphone blocked — allow mic access in your browser to dictate.',
  'service-not-allowed': 'Microphone blocked — allow mic access in your browser to dictate.',
  'audio-capture': 'No microphone found.',
  'no-speech': 'Didn’t catch that — try again.',
  network: 'Speech recognition needs a connection — check your network.',
};

/**
 * Web Speech API dictation. `onResult` fires for interim and final chunks so
 * callers can stream the transcript into an input.
 */
export function useSpeechRecognition({ lang = 'en-US', onResult } = {}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  });

  useEffect(() => {
    if (!SpeechRecognitionApi) return undefined;

    const recognition = new SpeechRecognitionApi();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (final) onResultRef.current?.(final.trim(), true);
      else if (interim) onResultRef.current?.(interim.trim(), false);
    };
    recognition.onerror = (event) => {
      setError(ERRORS[event.error] ?? 'Could not use the microphone.');
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    setError(null);
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() throws if it is already running; the session is live either way
      setListening(true);
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { supported: Boolean(SpeechRecognitionApi), listening, error, start, stop };
}
