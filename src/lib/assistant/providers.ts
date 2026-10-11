export const ASSISTANT_PROVIDER_IDS = ["anthropic", "openai", "xai", "gemini", "meta", "custom"] as const;
export type AssistantProvider = (typeof ASSISTANT_PROVIDER_IDS)[number];

export interface ProviderInfo {
  label: string;
  company: string;
  defaultModel: string;
  keyUrl: string;
  keyHint: string;
}

/** Default models were current in October 2026; each connection can name its own. */
export const ASSISTANT_PROVIDERS: Record<AssistantProvider, ProviderInfo> = {
  anthropic: { label: "Claude", company: "Anthropic", defaultModel: "claude-opus-5-5", keyUrl: "https://console.anthropic.com/settings/keys", keyHint: "Starts with sk-ant-" },
  openai: { label: "ChatGPT", company: "OpenAI", defaultModel: "gpt-6.1-sol", keyUrl: "https://platform.openai.com/api-keys", keyHint: "Starts with sk-" },
  xai: { label: "Grok", company: "xAI", defaultModel: "grok-4.3", keyUrl: "https://console.x.ai", keyHint: "Starts with xai-" },
  gemini: { label: "Gemini", company: "Google", defaultModel: "gemini-3.8-flash", keyUrl: "https://aistudio.google.com/apikey", keyHint: "From Google AI Studio" },
  meta: { label: "Muse", company: "Meta", defaultModel: "muse-spark-1.3", keyUrl: "https://dev.meta.ai", keyHint: "From the Meta developer console" },
  custom: { label: "Custom", company: "OpenAI compatible", defaultModel: "llama3.2", keyUrl: "https://ollama.com", keyHint: "Leave blank if your server needs no key" },
};
