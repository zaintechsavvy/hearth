import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { IntegrationError } from "@/lib/integrations/types";
import { ASSISTANT_PROVIDERS, type AssistantProvider } from "./providers";
import { ASSISTANT_TOOLS } from "./tools";

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AssistantRun {
  provider: AssistantProvider;
  model: string;
  apiKey: string;
  /** Required for `custom`, ignored otherwise. */
  baseUrl?: string | null;
  system: string;
  history: ChatTurn[];
  /** Runs one tool call by name and returns the text the model reads back. */
  callTool: (name: string, input: unknown) => Promise<string>;
}

const MAX_STEPS = 6;
const TIMEOUT_MS = 45_000;

/** Effort is rejected by Haiku 4.5, Sonnet 4.5, and older models. */
const supportsEffort = (model: string) => !/haiku|sonnet-4-5|claude-3/.test(model);
/** Server-side refusal fallback, with Anthropic choosing the substitute by refusal category. */
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

type HttpProvider = Exclude<AssistantProvider, "anthropic">;

const BASE_URLS: Record<Exclude<HttpProvider, "custom">, string> = {
  openai: "https://api.openai.com/v1",
  xai: "https://api.x.ai/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  meta: "https://api.meta.ai/v1",
  groq: "https://api.groq.com/openai/v1",
};

function baseUrlFor(provider: HttpProvider, custom?: string | null) {
  if (provider !== "custom") return BASE_URLS[provider];
  if (!custom) throw new IntegrationError("This assistant has no server address.");
  return custom.replace(/\/+$/, "");
}

const authHeaders = (apiKey: string): Record<string, string> => apiKey ? { Authorization: `Bearer ${apiKey}` } : {};

export function runAssistant(run: AssistantRun): Promise<string> {
  switch (run.provider) {
    case "anthropic":
      return runClaude(run);
    case "openai":
    case "xai":
      return runResponses(run);
    case "gemini":
    case "meta":
    case "groq":
    case "custom":
      return runChatCompletions(run);
  }
}

async function runClaude({ model, apiKey, system, history, callTool }: AssistantRun) {
  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map(turn => ({ role: turn.role, content: turn.text }));
  const fallback = FALLBACK_MODELS.has(model);
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await client.beta.messages.create({
        model,
        max_tokens: 4096,
        system,
        messages,
        tools: ASSISTANT_TOOLS.map(tool => ({ name: tool.name, description: tool.description, input_schema: tool.parameters as Anthropic.Beta.BetaTool["input_schema"] })),
        ...(supportsEffort(model) ? { output_config: { effort: "low" as const } } : {}),
        ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
      if (response.stop_reason === "refusal") return "Claude declined that request.";
      const toolUses = response.content.filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use");
      if (toolUses.length === 0 || response.stop_reason !== "tool_use") return textOf(response.content);
      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const use of toolUses) results.push({ type: "tool_result", tool_use_id: use.id, content: await callTool(use.name, use.input) });
      messages.push({ role: "user", content: results });
    }
    return "I made several changes. Check the dashboard for the result.";
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) throw new IntegrationError("Anthropic rejected the API key.");
    if (error instanceof Anthropic.RateLimitError) throw new IntegrationError("Anthropic is rate limiting requests. Try again in a moment.");
    if (error instanceof Anthropic.NotFoundError) throw new IntegrationError(`Anthropic does not recognise the model "${model}".`);
    if (error instanceof Anthropic.APIError) throw new IntegrationError(`Anthropic returned ${error.status ?? "an error"}: ${error.message}`);
    throw error;
  }
}

function textOf(blocks: Anthropic.Beta.BetaContentBlock[]) {
  return blocks.filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text").map(block => block.text).join("\n").trim() || "Done.";
}

async function post(provider: HttpProvider, baseUrl: string | null | undefined, path: string, apiKey: string, body: unknown) {
  let response: Response;
  try {
    response = await fetch(`${baseUrlFor(provider, baseUrl)}/${path}`, {
      method: "POST",
      headers: { ...authHeaders(apiKey), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new IntegrationError(`Could not reach ${ASSISTANT_PROVIDERS[provider].company}.`);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw providerError(provider, response.status, data);
  return data;
}

/** OpenAI-style errors are `{ error: { message } }`; xAI sends `{ error: "..." }`; Gemini wraps it in an array. */
export function providerError(provider: AssistantProvider, status: number, data: unknown) {
  const body = Array.isArray(data) ? data[0] : data as Record<string, unknown> | null;
  const raw = body?.error;
  const message = typeof raw === "string" ? raw : typeof raw === "object" && raw && "message" in raw ? String((raw as { message: unknown }).message) : "";
  const company = ASSISTANT_PROVIDERS[provider].company;
  if (status === 401 || status === 403 || (status === 400 && /api.?key/i.test(message))) return new IntegrationError(`${company} rejected the API key.`);
  if (status === 429) return new IntegrationError(`${company} is rate limiting requests. Try again in a moment.`);
  if (status === 404 || /model.*(not found|does not exist|decommissioned)|model_not_found/i.test(message)) return new IntegrationError(`${company} does not recognise that model. Choose Edit beside it in Settings, under AI assistants, to change it.`);
  return new IntegrationError(`${company} returned ${status}${message ? `: ${message.slice(0, 200)}` : ""}.`);
}

interface ResponsesItem {
  type: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  content?: { type: string; text?: string }[];
}

/** OpenAI's current models only call tools through the Responses API; xAI recommends it too. Output items are replayed unchanged so reasoning carries across tool turns. */
async function runResponses({ provider, model, apiKey, baseUrl, system, history, callTool }: AssistantRun) {
  const p = provider as "openai" | "xai";
  const input: unknown[] = history.map(turn => ({ role: turn.role, content: turn.text }));
  const tools = ASSISTANT_TOOLS.map(tool => ({ type: "function", name: tool.name, description: tool.description, parameters: tool.parameters }));
  for (let step = 0; step < MAX_STEPS; step++) {
    const data = await post(p, baseUrl, "responses", apiKey, { model, instructions: system, input, tools, ...(p === "openai" ? { reasoning: { effort: "low" } } : {}) }) as { output?: ResponsesItem[] };
    const output = data.output ?? [];
    const calls = output.filter(item => item.type === "function_call");
    if (calls.length === 0) {
      return output.filter(item => item.type === "message").flatMap(item => item.content ?? []).filter(part => part.type === "output_text").map(part => part.text).join("\n").trim() || "Done.";
    }
    input.push(...output);
    for (const call of calls) input.push({ type: "function_call_output", call_id: call.call_id, output: await callTool(call.name ?? "", call.arguments ?? "{}") });
  }
  return "I made several changes. Check the dashboard for the result.";
}

interface ChatMessage {
  role: string;
  content?: string | null;
  tool_calls?: { id: string; function: { name: string; arguments: string } }[];
}

/** Gemini, Muse, Groq, and custom servers over Chat Completions. The assistant message is echoed verbatim: Gemini rejects a tool turn whose thought signature was dropped. Muse only accepts the default tool choice, so none is sent. */
async function runChatCompletions({ provider, model, apiKey, baseUrl, system, history, callTool }: AssistantRun) {
  const p = provider as "gemini" | "meta" | "groq" | "custom";
  const messages: unknown[] = [{ role: "system", content: system }, ...history.map(turn => ({ role: turn.role, content: turn.text }))];
  const tools = ASSISTANT_TOOLS.map(tool => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } }));
  for (let step = 0; step < MAX_STEPS; step++) {
    const data = await post(p, baseUrl, "chat/completions", apiKey, { model, messages, tools }) as { choices?: { message: ChatMessage }[] };
    const message = data.choices?.[0]?.message;
    if (!message) throw new IntegrationError(`${ASSISTANT_PROVIDERS[p].company} sent an empty response.`);
    if (!message.tool_calls?.length) return message.content?.trim() || "Done.";
    // Gemini needs its reply back exactly, thought signature and all; Groq and others refuse fields such as `reasoning`.
    messages.push(p === "gemini" ? message : { role: "assistant", content: message.content ?? "", tool_calls: message.tool_calls });
    for (const call of message.tool_calls) messages.push({ role: "tool", tool_call_id: call.id, content: await callTool(call.function.name, call.function.arguments) });
  }
  return "I made several changes. Check the dashboard for the result.";
}

/** A free request that only succeeds with a working key; returns the model ids the key can use, when the provider lists them. */
export async function checkAssistantKey(provider: AssistantProvider, apiKey: string, baseUrl?: string | null): Promise<string[]> {
  if (provider === "anthropic") {
    try {
      await new Anthropic({ apiKey, timeout: 10_000, maxRetries: 0 }).models.list({ limit: 1 });
      return [];
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) throw new IntegrationError("Anthropic rejected the API key.");
      if (error instanceof Anthropic.APIConnectionError) throw new IntegrationError("Could not reach Anthropic.");
      throw error;
    }
  }
  let response: Response;
  try {
    response = await fetch(`${baseUrlFor(provider, baseUrl)}/models`, { headers: authHeaders(apiKey), signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new IntegrationError(`Could not reach ${ASSISTANT_PROVIDERS[provider].company}.`);
  }
  if (!response.ok) throw providerError(provider, response.status, await response.json().catch(() => null));
  const body = await response.json().catch(() => null) as { data?: { id?: unknown }[] } | null;
  return (body?.data ?? []).map(item => item.id).filter((id): id is string => typeof id === "string").map(id => id.replace(/^models\//, ""));
}
