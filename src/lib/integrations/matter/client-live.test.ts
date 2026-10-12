import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocketServer, type WebSocket as ServerSocket } from "ws";
import { MatterServerClient } from "./client";

let server: WebSocketServer | null = null;

afterEach(() => {
  server?.close();
  server = null;
});

describe("MatterServerClient live updates", () => {
  it("applies attribute_updated events and notifies listeners", async () => {
    let socket: ServerSocket | undefined;
    server = new WebSocketServer({ port: 0, path: "/ws" });
    server.on("connection", connection => {
      socket = connection;
      connection.send(JSON.stringify({ schema_version: 11, sdk_version: "test" }));
      connection.on("message", raw => {
        const message = JSON.parse(String(raw));
        if (message.command === "start_listening") connection.send(JSON.stringify({ message_id: message.message_id, result: [{ node_id: 7, available: true, attributes: { "1/6/0": false } }] }));
      });
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    const client = new MatterServerClient(`ws://127.0.0.1:${(server.address() as { port: number }).port}/ws`);
    const listener = vi.fn();
    client.subscribe(listener);

    await vi.waitFor(async () => expect((await client.getNodes())[0]?.attributes["1/6/0"]).toBe(false));
    const before = listener.mock.calls.length;
    socket?.send(JSON.stringify({ event: "attribute_updated", data: [7, "1/6/0", true] }));
    await vi.waitFor(async () => expect((await client.getNodes())[0].attributes["1/6/0"]).toBe(true));
    expect(listener.mock.calls.length).toBe(before + 1);
  });
});
