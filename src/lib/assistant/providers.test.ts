import { describe, expect, it } from "vitest";
import { matchModel, providerOfKey } from "./providers";

describe("providerOfKey", () => {
  it("knows Groq, xAI, and Anthropic keys by their prefix", () => {
    expect(providerOfKey("gsk_abc123")).toBe("groq");
    expect(providerOfKey("xai-abc123")).toBe("xai");
    expect(providerOfKey("sk-ant-abc")).toBe("anthropic");
    expect(providerOfKey("sk-proj-abc")).toBeNull();
  });
});

describe("matchModel", () => {
  const ids = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "moonshotai/kimi-k2-instruct"];
  it("turns a model's display name into the provider's id", () => {
    expect(matchModel("OpenAI GPT OSS 120B", ids)).toBe("openai/gpt-oss-120b");
    expect(matchModel("Kimi K2 Instruct", ids)).toBe("moonshotai/kimi-k2-instruct");
    expect(matchModel("llama-3.3-70b-versatile", ids)).toBe("llama-3.3-70b-versatile");
    expect(matchModel("gpt-5", ids)).toBeNull();
  });
});
