"use client";

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}

export interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onspeechstart: (() => void) | null;
  start(): void;
  stop(): void;
}

type RecognitionConstructor = new () => Recognition;

/** The Web Speech API ships unprefixed in some browsers and as `webkitSpeechRecognition` in Chrome and Safari. */
export function createRecognition(): Recognition | null {
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  const Constructor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  if (!Constructor) return null;
  const recognition = new Constructor();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;
  return recognition;
}

/**
 * Android hands the microphone to its own recogniser, and a second capture for the voice glow can make recognition
 * fail, so there the glow follows the recogniser's own sense of speech instead of the raw audio.
 */
export const sharesMicrophone = () => typeof navigator !== "undefined" && !/Android/i.test(navigator.userAgent);

export const speechSupported = () => typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

export function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}
