import { describe, expect, it } from "vitest";
import { relayStreamName, rtspSource } from "./stream-relay";

describe("rtspSource", () => {
  it("percent encodes credentials into the URL", () => {
    expect(rtspSource({ url: "rtsp://10.0.0.5:554/live", username: "admin", password: "p@ss:w/rd" })).toBe("rtsp://admin:p%40ss%3Aw%2Frd@10.0.0.5:554/live");
  });

  it("leaves URLs without credentials alone", () => {
    expect(rtspSource({ url: "rtsp://10.0.0.5/stream" })).toBe("rtsp://10.0.0.5/stream");
    expect(relayStreamName("a-b-c")).toBe("hearth_abc");
  });
});
