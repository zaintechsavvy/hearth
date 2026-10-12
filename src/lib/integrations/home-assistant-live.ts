import type { TemperatureUnit } from "@/lib/devices/types";
import type { HassState } from "./home-assistant";

type Message =
  | { type: "auth_required" | "auth_ok" }
  | { type: "auth_invalid"; message?: string }
  | { type: "result"; id: number; success: boolean; result?: unknown; error?: { message?: string } }
  | { type: "event"; id: number; event: { event_type: string; data: { entity_id: string; new_state: HassState | null } } }
  | { type: "pong"; id: number };

interface DisplayRegistry {
  entities: { ei: string; ec?: number; hb?: boolean }[];
}

/** Only domains Hearth shows wake listeners; the rest (updates, numbers, device trackers) change often and matter to no tile. */
const WATCHED = new Set(["light", "switch", "input_boolean", "fan", "climate", "lock", "cover", "binary_sensor", "sensor", "camera", "event", "scene", "script", "button", "input_button"]);
const RECONNECT_MIN_MS = 2000;
const RECONNECT_MAX_MS = 30_000;
const IDLE_CLOSE_MS = 60_000;

export const webSocketUrl = (baseUrl: string) => {
  const url = new URL("api/websocket", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

/**
 * A mirror of Home Assistant's state machine over its WebSocket API: authenticate, load every state once,
 * then apply `state_changed` events. Open only while something listens, and reconnects with backoff.
 */
export class HomeAssistantLive {
  private socket: WebSocket | null = null;
  private sequence = 0;
  private readonly states = new Map<string, HassState>();
  /** Entities Home Assistant files under settings or diagnostics, or hides. */
  readonly auxiliary = new Set<string>();
  private readonly listeners = new Set<() => void>();
  private ready = false;
  private retryMs = RECONNECT_MIN_MS;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  unit: TemperatureUnit = "C";
  error: string | null = null;

  constructor(private readonly baseUrl: string, private readonly token: string) {}

  /** The latest states, or null until the first full load has arrived. */
  snapshot(): HassState[] | null {
    return this.ready ? [...this.states.values()] : null;
  }

  /** Connects for a moment if needed and resolves once states have loaded, or after the timeout. */
  waitUntilReady(timeoutMs: number) {
    if (this.ready) return Promise.resolve(true);
    return new Promise<boolean>(resolve => {
      const done = (value: boolean) => {
        clearTimeout(timer);
        stop();
        resolve(value);
      };
      const stop = this.subscribe(() => this.ready && done(true));
      const timer = setTimeout(() => done(this.ready), timeoutMs);
    });
  }

  subscribe(listener: () => void) {
    clearTimeout(this.idleTimer);
    this.listeners.add(listener);
    if (!this.socket) this.open();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.idleTimer = setTimeout(() => this.close(), IDLE_CLOSE_MS);
    };
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  private send(message: Record<string, unknown>) {
    const id = ++this.sequence;
    this.socket?.send(JSON.stringify({ id, ...message }));
    return id;
  }

  private open() {
    clearTimeout(this.retryTimer);
    let socket: WebSocket;
    try {
      socket = new WebSocket(webSocketUrl(this.baseUrl));
    } catch {
      this.error = "Invalid Home Assistant address.";
      return;
    }
    this.socket = socket;
    const pending = new Map<number, "states" | "config" | "subscribe" | "registry">();

    socket.addEventListener("message", event => {
      const message = JSON.parse(String(event.data)) as Message;
      switch (message.type) {
        case "auth_required":
          socket.send(JSON.stringify({ type: "auth", access_token: this.token }));
          return;
        case "auth_invalid":
          this.error = "Home Assistant rejected the access token.";
          this.listeners.clear();
          socket.close();
          return;
        case "auth_ok":
          pending.set(this.send({ type: "get_config" }), "config");
          pending.set(this.send({ type: "config/entity_registry/list_for_display" }), "registry");
          pending.set(this.send({ type: "subscribe_events", event_type: "state_changed" }), "subscribe");
          pending.set(this.send({ type: "get_states" }), "states");
          return;
        case "result": {
          const kind = pending.get(message.id);
          pending.delete(message.id);
          if (!message.success) return;
          if (kind === "registry") {
            this.auxiliary.clear();
            for (const entry of (message.result as DisplayRegistry).entities ?? []) if (entry.ec !== undefined || entry.hb) this.auxiliary.add(entry.ei);
          }
          if (kind === "config") this.unit = (message.result as { unit_system?: { temperature?: string } })?.unit_system?.temperature === "°F" ? "F" : "C";
          if (kind === "states") {
            this.states.clear();
            for (const state of message.result as HassState[]) this.states.set(state.entity_id, state);
            this.ready = true;
            this.error = null;
            this.retryMs = RECONNECT_MIN_MS;
            this.notify();
          }
          return;
        }
        case "event": {
          const { entity_id, new_state } = message.event.data;
          if (new_state) this.states.set(entity_id, new_state);
          else this.states.delete(entity_id);
          if (this.ready && WATCHED.has(entity_id.split(".")[0])) this.notify();
          return;
        }
      }
    });

    socket.addEventListener("close", () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.ready = false;
      if (this.listeners.size === 0) return;
      this.retryTimer = setTimeout(() => this.open(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, RECONNECT_MAX_MS);
    });
    socket.addEventListener("error", () => socket.close());
  }

  close() {
    clearTimeout(this.retryTimer);
    clearTimeout(this.idleTimer);
    const socket = this.socket;
    this.socket = null;
    this.ready = false;
    socket?.close();
  }
}

const registry = globalThis as unknown as { hearthHassLive?: Map<string, HomeAssistantLive> };
const clients: Map<string, HomeAssistantLive> = registry.hearthHassLive ??= new Map();

export function homeAssistantLive(baseUrl: string, token: string, integrationId: string): HomeAssistantLive {
  let client = clients.get(integrationId);
  if (!client) clients.set(integrationId, client = new HomeAssistantLive(baseUrl, token));
  return client;
}
