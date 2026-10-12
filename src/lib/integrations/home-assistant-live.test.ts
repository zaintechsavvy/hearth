import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer, type WebSocket as ServerSocket } from "ws";
import { HomeAssistantLive, webSocketUrl } from "./home-assistant-live";

const servers: WebSocketServer[] = [];

function fakeHomeAssistant(token: string) {
  const server = new WebSocketServer({ port: 0, path: "/api/websocket" });
  servers.push(server);
  const sockets: ServerSocket[] = [];
  let subscription = 0;
  server.on("connection", socket => {
    sockets.push(socket);
    socket.send(JSON.stringify({ type: "auth_required" }));
    socket.on("message", raw => {
      const message = JSON.parse(String(raw));
      if (message.type === "auth") return socket.send(JSON.stringify(message.access_token === token ? { type: "auth_ok" } : { type: "auth_invalid", message: "bad" }));
      if (message.type === "get_config") return socket.send(JSON.stringify({ id: message.id, type: "result", success: true, result: { unit_system: { temperature: "°F" } } }));
      if (message.type === "subscribe_events") {
        subscription = message.id;
        return socket.send(JSON.stringify({ id: message.id, type: "result", success: true, result: null }));
      }
      if (message.type === "get_states") return socket.send(JSON.stringify({ id: message.id, type: "result", success: true, result: [{ entity_id: "light.hall", state: "off", attributes: {} }] }));
    });
  });
  const port = () => (server.address() as { port: number }).port;
  const push = (entityId: string, state: string) => sockets.forEach(socket => socket.send(JSON.stringify({
    id: subscription, type: "event", event: { event_type: "state_changed", data: { entity_id: entityId, new_state: { entity_id: entityId, state, attributes: {} } } },
  })));
  return { port, push };
}

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

describe("HomeAssistantLive", () => {
  it("derives the WebSocket address from the base URL", () => {
    expect(webSocketUrl("http://ha.local:8123")).toBe("ws://ha.local:8123/api/websocket");
    expect(webSocketUrl("https://home.example.com/")).toBe("wss://home.example.com/api/websocket");
  });

  it("authenticates, mirrors states, and notifies on watched changes only", async () => {
    const ha = fakeHomeAssistant("good-token");
    await new Promise(resolve => setTimeout(resolve, 20));
    const live = new HomeAssistantLive(`http://127.0.0.1:${ha.port()}`, "good-token");
    const listener = vi.fn();
    const stop = live.subscribe(listener);

    await vi.waitFor(() => expect(live.snapshot()).toEqual([{ entity_id: "light.hall", state: "off", attributes: {} }]));
    expect(live.unit).toBe("F");
    const afterLoad = listener.mock.calls.length;

    ha.push("sensor.power", "120");
    ha.push("light.hall", "on");
    await vi.waitFor(() => expect(live.snapshot()?.find(state => state.entity_id === "light.hall")?.state).toBe("on"));
    expect(listener.mock.calls.length).toBe(afterLoad + 1);

    stop();
    live.close();
  });

  it("reports a rejected token and stops", async () => {
    const ha = fakeHomeAssistant("good-token");
    await new Promise(resolve => setTimeout(resolve, 20));
    const live = new HomeAssistantLive(`http://127.0.0.1:${ha.port()}`, "wrong");
    live.subscribe(() => {});
    await vi.waitFor(() => expect(live.error).toBe("Home Assistant rejected the access token."));
    expect(live.snapshot()).toBeNull();
    live.close();
  });
});
