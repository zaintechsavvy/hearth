import { unreachableMessage } from "../reach";
import { IntegrationError } from "../types";

export interface MatterNode {
  node_id: number | bigint;
  available: boolean;
  is_bridge?: boolean;
  /** Keyed `endpoint/cluster/attribute`; struct values are keyed by TLV tag, such as `{ "0": 257, "1": 1 }`. */
  attributes: Record<string, unknown>;
}

export interface MatterServerInfo {
  schema_version: number;
  sdk_version?: string;
  bluetooth_enabled?: boolean;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type ResultMessage = { message_id: string; result?: unknown; error_code?: number; details?: string | null };
type EventMessage = { event: string; data: unknown };

/** Fabric and node ids are 64 bit; keep any integer that does not fit a double exact as a BigInt. */
export function parseMessage(text: string): unknown {
  return JSON.parse(text, (_key, value, context?: { source?: string }) =>
    typeof value === "number" && !Number.isSafeInteger(value) && context?.source && /^-?\d+$/.test(context.source) ? BigInt(context.source) : value);
}

export function serializeMessage(value: unknown): string {
  return JSON.stringify(value, (_key, item) => typeof item === "bigint" ? JSON.rawJSON(item.toString()) : item);
}

/** Wire value for a node id held as a string. */
export const wireNodeId = (nodeId: string) => BigInt(nodeId);

/**
 * One long-lived connection per Matter server (python-matter-server or the matter.js server, which share
 * this protocol). `start_listening` returns every node and then streams changes, so reads come from memory.
 */
export class MatterServerClient {
  private socket: WebSocket | null = null;
  private connecting: Promise<void> | null = null;
  private readonly nodes = new Map<string, MatterNode>();
  private readonly pending = new Map<string, Pending>();
  private sequence = 0;
  private readonly listeners = new Set<() => void>();
  /** When each `node/endpoint` last fired an event, such as a button or doorbell press. */
  readonly lastEvents = new Map<string, string>();
  info: MatterServerInfo | null = null;

  constructor(readonly url: string) {}

  connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    return this.connecting ??= this.open().finally(() => { this.connecting = null; });
  }

  /** Listens for node and attribute changes, connecting if needed. */
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    this.connect().catch(() => undefined);
    return () => void this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  async getNodes(): Promise<MatterNode[]> {
    await this.connect();
    return [...this.nodes.values()];
  }

  async getNode(nodeId: string): Promise<MatterNode | undefined> {
    await this.connect();
    return this.nodes.get(nodeId);
  }

  async request<T>(command: string, args: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<T> {
    await this.connect();
    return this.send<T>(command, args, timeoutMs);
  }

  private open() {
    return new Promise<void>((resolve, reject) => {
      let socket: WebSocket;
      try {
        socket = new WebSocket(this.url);
      } catch {
        return reject(new IntegrationError(`"${this.url}" is not a valid WebSocket address.`));
      }
      const fail = (message: string) => {
        clearTimeout(timer);
        reject(new IntegrationError(message));
      };
      const timer = setTimeout(() => {
        socket.close();
        fail(`Timed out connecting to the Matter server at ${this.url}.`);
      }, 8000);
      let greeted = false;

      socket.addEventListener("message", event => {
        const message = parseMessage(String(event.data));
        if (greeted) return this.handle(message);
        greeted = true;
        this.info = message as MatterServerInfo;
        this.socket = socket;
        this.send<MatterNode[]>("start_listening").then(nodes => {
          this.nodes.clear();
          for (const node of nodes) this.nodes.set(String(node.node_id), node);
          clearTimeout(timer);
          resolve();
          this.notify();
        }, error => {
          socket.close();
          fail(error instanceof Error ? error.message : "The Matter server refused to stream updates.");
        });
      });
      socket.addEventListener("error", () => fail(unreachableMessage("the Matter server", new URL(this.url))));
      socket.addEventListener("close", () => {
        if (this.socket === socket) this.socket = null;
        this.nodes.clear();
        this.notify();
        for (const pending of this.pending.values()) {
          clearTimeout(pending.timer);
          pending.reject(new IntegrationError("The connection to the Matter server closed."));
        }
        this.pending.clear();
        fail("The Matter server closed the connection.");
      });
    });
  }

  private send<T>(command: string, args: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<T> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return Promise.reject(new IntegrationError("Not connected to the Matter server."));
    const messageId = String(++this.sequence);
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(messageId);
        reject(new IntegrationError(`The Matter server did not answer "${command}" in time.`));
      }, timeoutMs);
      this.pending.set(messageId, { resolve: value => resolve(value as T), reject, timer });
      socket.send(serializeMessage({ message_id: messageId, command, args }));
    });
  }

  private handle(message: unknown) {
    if (!message || typeof message !== "object") return;
    if ("message_id" in message) {
      const { message_id, error_code, details, result } = message as ResultMessage;
      const pending = this.pending.get(String(message_id));
      if (!pending) return;
      this.pending.delete(String(message_id));
      clearTimeout(pending.timer);
      if (error_code !== undefined) pending.reject(new IntegrationError(details || `The Matter server reported error ${error_code}.`));
      else pending.resolve(result);
      return;
    }
    if (!("event" in message)) return;
    const { event, data } = message as EventMessage;
    switch (event) {
      case "node_added":
      case "node_updated": {
        const node = data as MatterNode;
        this.nodes.set(String(node.node_id), node);
        break;
      }
      case "node_removed":
        this.nodes.delete(String(data));
        break;
      case "node_event": {
        const { node_id, endpoint_id } = data as { node_id: number | bigint; endpoint_id: number };
        this.lastEvents.set(`${node_id}/${endpoint_id}`, new Date().toISOString());
        break;
      }
      case "attribute_updated": {
        const [nodeId, path, value] = data as [number | bigint, string, unknown];
        const node = this.nodes.get(String(nodeId));
        if (node) node.attributes[path] = value;
        break;
      }
      default:
        return;
    }
    this.notify();
  }
}

const registry = globalThis as unknown as { hearthMatterClients?: Map<string, MatterServerClient> };
const clients: Map<string, MatterServerClient> = registry.hearthMatterClients ??= new Map();

export function matterClient(url: string): MatterServerClient {
  let client = clients.get(url);
  if (!client) clients.set(url, client = new MatterServerClient(url));
  return client;
}
