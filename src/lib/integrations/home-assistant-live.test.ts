import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer, type WebSocket as ServerSocket } from "ws";
import { HomeAssistantProvider } from "./home-assistant";
import { HomeAssistantLive, webSocketUrl } from "./home-assistant-live";
import { WebRtcUnsupportedError } from "./types";

const servers: WebSocketServer[] = [];

function fakeHomeAssistant(token: string) {
  const server = new WebSocketServer({ port: 0, path: "/api/websocket" });
  servers.push(server);
  const sockets: ServerSocket[] = [];
  let subscription = 0;
  const unsubscribed: number[] = [];
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
      if (message.type === "camera/capabilities") {
        const types = message.entity_id === "camera.porch" ? ["web_rtc"] : ["hls"];
        return socket.send(JSON.stringify({ id: message.id, type: "result", success: true, result: { frontend_stream_types: types } }));
      }
      if (message.type === "camera/webrtc/offer") {
        const send = (event: unknown) => socket.send(JSON.stringify({ id: message.id, type: "event", event }));
        socket.send(JSON.stringify({ id: message.id, type: "result", success: true, result: null }));
        send({ type: "session", session_id: "abc" });
        send({ type: "answer", answer: `v=0 answer to ${message.offer}` });
        setTimeout(() => send({ type: "candidate", candidate: { candidate: "candidate:1 1 udp 1 192.168.1.5 8555 typ host", sdpMid: "0", sdpMLineIndex: 0 } }), 30);
        return;
      }
      if (message.type === "unsubscribe_events") {
        unsubscribed.push(message.subscription);
        return socket.send(JSON.stringify({ id: message.id, type: "result", success: true, result: null }));
      }
    });
  });
  const port = () => (server.address() as { port: number }).port;
  const push = (entityId: string, state: string) => sockets.forEach(socket => socket.send(JSON.stringify({
    id: subscription, type: "event", event: { event_type: "state_changed", data: { entity_id: entityId, new_state: { entity_id: entityId, state, attributes: {} } } },
  })));
  return { port, push, unsubscribed };
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

    ha.push("update.home_assistant_core", "on");
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

  it("negotiates camera WebRTC, collects trickled candidates, and unsubscribes on close", async () => {
    const ha = fakeHomeAssistant("good-token");
    await new Promise(resolve => setTimeout(resolve, 20));
    const provider = new HomeAssistantProvider(`webrtc-${ha.port()}`, { url: `http://127.0.0.1:${ha.port()}`, token: "good-token" });

    const session = await provider.cameraWebRtc("camera.porch", "v=0 offer");
    expect(session.answer).toBe("v=0 answer to v=0 offer");
    expect(session.candidates).toEqual([{ candidate: "candidate:1 1 udp 1 192.168.1.5 8555 typ host", sdpMid: "0", sdpMLineIndex: 0 }]);
    session.close();
    await vi.waitFor(() => expect(ha.unsubscribed).toHaveLength(1));

    await expect(provider.cameraWebRtc("camera.garage", "v=0 offer")).rejects.toBeInstanceOf(WebRtcUnsupportedError);
  });
});
