import "server-only";

interface Session {
  userId: string;
  close: () => void;
  seenAt: number;
}

/** Players ping well inside this; a session not heard from for this long belongs to a closed tab. */
const IDLE_MS = 45_000;
const SWEEP_MS = 15_000;

const registry = globalThis as unknown as { hearthWebRtc?: { sessions: Map<string, Session>; sweeper: ReturnType<typeof setInterval> } };
const state = registry.hearthWebRtc ??= {
  sessions: new Map(),
  sweeper: setInterval(() => {
    const now = Date.now();
    for (const [id, session] of state.sessions) if (now - session.seenAt > IDLE_MS) closeSession(session.userId, id);
  }, SWEEP_MS),
};
state.sweeper.unref?.();

export function openSession(userId: string, close: () => void) {
  const id = crypto.randomUUID();
  state.sessions.set(id, { userId, close, seenAt: Date.now() });
  return id;
}

export function touchSession(userId: string, id: string) {
  const session = state.sessions.get(id);
  if (!session || session.userId !== userId) return false;
  session.seenAt = Date.now();
  return true;
}

export function closeSession(userId: string, id: string) {
  const session = state.sessions.get(id);
  if (!session || session.userId !== userId) return;
  state.sessions.delete(id);
  session.close();
}
