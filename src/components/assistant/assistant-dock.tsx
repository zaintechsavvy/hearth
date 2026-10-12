"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Mic, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Button } from "@/components/arc/button/button";
import { ChatComposer, type ChatComposerHandle } from "@/components/arc/chat-thread/chat-thread";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import { createRecognition, speak, speechSupported, type Recognition } from "./speech";
import styles from "./assistant-dock.module.css";

interface AssistantInfo {
  configured: boolean;
  label?: string;
  model?: string;
}

interface Action {
  deviceId: string;
  name: string;
  summary: string;
  ok: boolean;
}

interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
  actions?: Action[];
  error?: boolean;
}

const SUGGESTIONS = ["Turn on the bedroom fan", "Dim the kitchen lights to 30%", "Set the thermostat to 21°", "Turn everything off"];
const subscribeNever = () => () => {};

const fetchInfo = (url: string) => fetch(url).then(response => response.json() as Promise<AssistantInfo>);

/** Opens the assistant from anywhere, such as the command palette, optionally with a request to send. */
export const ASK_EVENT = "hearth-ask";
export const askHearth = (text = "") => window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: text }));

export function AssistantDock() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const composer = useRef<ChatComposerHandle>(null);
  const log = useRef<HTMLOListElement>(null);
  const canListen = useSyncExternalStore(subscribeNever, speechSupported, () => false);
  const { data: info } = useSWR<AssistantInfo>(open ? "/api/assistant" : null, fetchInfo);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setOpen(value => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => composer.current?.focus());
    else recognition.current?.stop();
  }, [open]);

  useEffect(() => {
    log.current?.lastElementChild?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [turns, pending, reduce]);

  const send = useCallback(async (text: string, spoken = false) => {
    const message = text.trim();
    if (!message || pending) return;
    const next: Turn[] = [...turns, { id: crypto.randomUUID(), role: "user", text: message }];
    setTurns(next);
    setPending(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter(turn => !turn.error).slice(-12).map(turn => ({ role: turn.role, text: turn.text })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "The assistant did not answer.");
      setTurns(current => [...current, { id: crypto.randomUUID(), role: "assistant", text: data.reply, actions: data.actions }]);
      if (data.actions?.length) void mutate("/api/home");
      if (spoken) speak(data.reply);
    } catch (cause) {
      setTurns(current => [...current, { id: crypto.randomUUID(), role: "assistant", text: cause instanceof Error ? cause.message : "The assistant did not answer.", error: true }]);
    } finally {
      setPending(false);
    }
  }, [mutate, pending, turns]);

  const latestSend = useRef(send);
  useEffect(() => { latestSend.current = send; }, [send]);
  useEffect(() => {
    const onAsk = (event: Event) => {
      setOpen(true);
      const text = (event as CustomEvent<string>).detail;
      if (text) void latestSend.current(text);
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, []);

  function toggleListening() {
    if (listening) return recognition.current?.stop();
    const instance = createRecognition();
    if (!instance) return;
    recognition.current = instance;
    let finalText = "";
    instance.onresult = event => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      setHeard(finalText + interim);
    };
    instance.onend = () => {
      setListening(false);
      setHeard("");
      if (finalText.trim()) void send(finalText, true);
    };
    instance.onerror = () => setListening(false);
    setListening(true);
    instance.start();
  }

  const spring = reduce ? { duration: 0 } : motionTokens.spring.morph;
  const configured = info?.configured;

  return (
    <div className={styles.anchor} data-wall-assistant>
      <AnimatePresence initial={false} mode="popLayout">
        {open ? (
          <motion.section
            key="panel"
            layoutId="assistant"
            className={styles.panel}
            transition={spring}
            style={{ borderRadius: 30 }}
            aria-label="Assistant"
            role="dialog"
          >
            <motion.div className={styles.panelInner} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: reduce ? 0 : 0.12 } }} exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}>
              <header className={styles.header}>
                <Sparkles size={18} strokeWidth={1.75} aria-hidden="true" />
                <div className={styles.headerText}>
                  <h2 className={styles.title}>Assistant</h2>
                  {configured && <p className={styles.subtitle}>{info?.label} · {info?.model}</p>}
                </div>
                <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close assistant">
                  <X size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </header>

              {info && !configured ? (
                <div className={styles.unconfigured}>
                  <EmptyState
                    icon={<Sparkles size={24} strokeWidth={1.75} />}
                    title="Connect an assistant"
                    description="Add an API key for Claude, ChatGPT, Grok, Gemini, Muse, or Groq, and ask for changes in plain words."
                    action={<Button variant="secondary" onClick={() => { setOpen(false); router.push("/settings#assistants"); }}>Open Settings</Button>}
                  />
                </div>
              ) : (
                <>
                  <ol ref={log} className={styles.log} aria-live="polite">
                    {turns.length === 0 && (
                      <li className={styles.suggestions}>
                        <p className={styles.hint}>Try one of these, or say it out loud.</p>
                        {SUGGESTIONS.map(suggestion => (
                          <button key={suggestion} type="button" className={styles.suggestion} onClick={() => send(suggestion)}>{suggestion}</button>
                        ))}
                      </li>
                    )}
                    {turns.map(turn => (
                      <li key={turn.id} className={styles.turn} data-role={turn.role} data-error={turn.error || undefined}>
                        <p className={styles.bubble}>{turn.text}</p>
                        {turn.actions && turn.actions.length > 0 && (
                          <ul className={styles.actions} aria-label="Changes">
                            {turn.actions.map((action, index) => (
                              <li key={`${action.deviceId}-${index}`} className={styles.action} data-ok={action.ok || undefined}>
                                {action.ok ? <Check size={12} strokeWidth={2} aria-hidden="true" /> : <X size={12} strokeWidth={2} aria-hidden="true" />}
                                {action.name} · {action.summary}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                    {pending && <li className={styles.turn} data-role="assistant"><TextShimmer className={styles.working}>Working on it</TextShimmer></li>}
                  </ol>
                  {listening && <p className={styles.listening}><span className={styles.pulse} aria-hidden="true" />{heard || "Listening"}</p>}
                  <div className={styles.composerRow}>
                    <ChatComposer ref={composer} className={styles.composer} placeholder="Ask Hearth" allowAttachments={false} disabled={pending} onSend={draft => void send(draft.text)} />
                    {canListen && (
                      <button type="button" className={styles.mic} data-active={listening || undefined} onClick={toggleListening} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Speak a request"}>
                        <Mic size={18} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.section>
        ) : (
          <motion.button
            key="pill"
            layoutId="assistant"
            type="button"
            className={styles.pill}
            transition={spring}
            style={{ borderRadius: 999 }}
            onClick={() => setOpen(true)}
            aria-label="Open the assistant"
            aria-keyshortcuts="Meta+J Control+J"
          >
            <motion.span className={styles.pillInner} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>Ask Hearth</span>
              <kbd className={styles.kbd}>⌘J</kbd>
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
