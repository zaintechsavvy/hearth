import { afterEach, describe, expect, it, vi } from "vitest";
import { providerError, runAssistant, type AssistantRun } from "./run";

interface Call {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function stubFetch(replies: unknown[]) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    calls.push({ url: String(input instanceof Request ? input.url : input), headers, body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify(replies[calls.length - 1]), { status: 200, headers: { "Content-Type": "application/json" } });
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

const base = (provider: AssistantRun["provider"], model: string, callTool = vi.fn(async () => "Done. Fan accepted turn_on.")) => ({
  provider, model, apiKey: "test-key-1234567890", system: "You control a home.", history: [{ role: "user" as const, text: "Turn on the fan" }], callTool,
});

describe("Chat Completions adapter", () => {
  it("echoes Gemini's assistant message verbatim so its thought signature survives", async () => {
    const toolMessage = { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "control_device", arguments: "{\"device_id\":\"a:fan\",\"action\":\"turn_on\"}" }, extra_content: { google: { thought_signature: "sig" } } }] };
    const calls = stubFetch([{ choices: [{ message: toolMessage }] }, { choices: [{ message: { role: "assistant", content: "The fan is on." } }] }]);
    const run = base("gemini", "gemini-3.8-flash");
    expect(await runAssistant(run)).toBe("The fan is on.");
    expect(run.callTool).toHaveBeenCalledWith("{\"device_id\":\"a:fan\",\"action\":\"turn_on\"}");
    expect(calls[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(calls[0].headers.authorization).toBe("Bearer test-key-1234567890");
    expect(calls[1].body.messages).toEqual([
      { role: "system", content: "You control a home." },
      { role: "user", content: "Turn on the fan" },
      toolMessage,
      { role: "tool", tool_call_id: "c1", content: "Done. Fan accepted turn_on." },
    ]);
  });

  it("never sends tool_choice or sampling settings to Muse", async () => {
    const calls = stubFetch([{ choices: [{ message: { role: "assistant", content: "Hello." } }] }]);
    await runAssistant(base("meta", "muse-spark-1.3"));
    expect(calls[0].url).toBe("https://api.meta.ai/v1/chat/completions");
    expect(Object.keys(calls[0].body).sort()).toEqual(["messages", "model", "tools"]);
  });

  it("talks to a custom server without a key", async () => {
    const calls = stubFetch([{ choices: [{ message: { role: "assistant", content: "Hi." } }] }]);
    await runAssistant({ ...base("custom", "llama3.2"), apiKey: "", baseUrl: "http://localhost:11434/v1/" });
    expect(calls[0].url).toBe("http://localhost:11434/v1/chat/completions");
    expect(calls[0].headers.authorization).toBeUndefined();
  });
});

describe("Responses adapter", () => {
  it("replays every output item, then returns function results by call id", async () => {
    const reasoning = { type: "reasoning", id: "rs_1", summary: [] };
    const call = { type: "function_call", id: "fc_1", call_id: "call_1", name: "control_device", arguments: "{\"device_id\":\"a:fan\",\"action\":\"turn_on\"}" };
    const calls = stubFetch([{ output: [reasoning, call] }, { output: [{ type: "message", content: [{ type: "output_text", text: "Fan on." }] }] }]);
    expect(await runAssistant(base("openai", "gpt-6.1-sol"))).toBe("Fan on.");
    expect(calls[0].url).toBe("https://api.openai.com/v1/responses");
    expect(calls[0].body.reasoning).toEqual({ effort: "low" });
    expect(calls[0].body.tools).toEqual([expect.objectContaining({ type: "function", name: "control_device" })]);
    expect(calls[1].body.input).toEqual([
      { role: "user", content: "Turn on the fan" },
      reasoning,
      call,
      { type: "function_call_output", call_id: "call_1", output: "Done. Fan accepted turn_on." },
    ]);
  });

  it("sends Grok no reasoning setting", async () => {
    const calls = stubFetch([{ output: [{ type: "message", content: [{ type: "output_text", text: "Hi." }] }] }]);
    await runAssistant(base("xai", "grok-4.3"));
    expect(calls[0].url).toBe("https://api.x.ai/v1/responses");
    expect(calls[0].body.reasoning).toBeUndefined();
  });
});

describe("Claude adapter", () => {
  const toolTurn = {
    id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason: "tool_use", stop_sequence: null,
    content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "tool_use", id: "tu_1", name: "control_device", input: { device_id: "a:fan", action: "turn_on" } }],
    usage: { input_tokens: 1, output_tokens: 1 },
  };
  const finalTurn = { ...toolTurn, id: "msg_2", stop_reason: "end_turn", content: [{ type: "text", text: "The fan is on." }] };

  it("loops on tool_use, passes content back unchanged, and opts into the default fallback", async () => {
    const calls = stubFetch([toolTurn, finalTurn]);
    const run = base("anthropic", "claude-opus-5-5");
    expect(await runAssistant(run)).toBe("The fan is on.");
    expect(run.callTool).toHaveBeenCalledWith({ device_id: "a:fan", action: "turn_on" });
    expect(calls[0].url).toBe("https://api.anthropic.com/v1/messages?beta=true");
    expect(calls[0].headers["x-api-key"]).toBe("test-key-1234567890");
    expect(calls[0].headers["anthropic-beta"]).toBe("server-side-fallback-2026-07-01");
    expect(calls[0].body).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", output_config: { effort: "low" } });
    expect(calls[1].body.messages).toEqual([
      { role: "user", content: "Turn on the fan" },
      { role: "assistant", content: toolTurn.content },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "tu_1", content: "Done. Fan accepted turn_on." }] },
    ]);
  });

  it("leaves out effort and fallbacks for Haiku", async () => {
    const calls = stubFetch([{ ...finalTurn, model: "claude-haiku-4-5" }]);
    await runAssistant(base("anthropic", "claude-haiku-4-5"));
    expect(calls[0].body.output_config).toBeUndefined();
    expect(calls[0].body.fallbacks).toBeUndefined();
  });

  it("reports a refusal instead of reading content", async () => {
    stubFetch([{ ...finalTurn, stop_reason: "refusal", content: [] }]);
    expect(await runAssistant(base("anthropic", "claude-opus-5-5"))).toBe("Claude declined that request.");
  });
});

describe("providerError", () => {
  it("treats xAI's 400 for a bad key as a rejected key", () => {
    expect(providerError("xai", 400, { code: "invalid-argument", error: "Incorrect API key provided" }).message).toBe("xAI rejected the API key.");
  });

  it("unwraps Gemini's array errors and names rate limits", () => {
    expect(providerError("gemini", 400, [{ error: { message: "API key not valid. Please pass a valid API key." } }]).message).toBe("Google rejected the API key.");
    expect(providerError("openai", 429, null).message).toContain("rate limiting");
  });
});
