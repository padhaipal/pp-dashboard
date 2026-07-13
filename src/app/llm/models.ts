// SELF-CONTAINED LLM PLAYGROUND — safe to delete this whole `src/app/llm` folder
// (plus `src/app/api/llm`) to remove the feature. Server-only: imported by
// page.tsx and the /api/llm route, never by client code (keeps keys off browser).
//
// To add a model: append a row below. To switch a provider's model: change its
// `model` string. Prices are hardcoded per 1M tokens (approx. mid-2026, edit here).

export type ModelDef = {
  id: string; // stable key used by client + route
  label: string; // shown on the checkbox / result card
  provider: string; // grouping header
  envKey: string; // Railway env var holding the API key
  baseUrl: string; // OpenAI-compatible base (no trailing slash)
  model: string; // provider's model id — change this line to switch model
  priceIn: number; // USD per 1M input tokens
  priceOut: number; // USD per 1M output tokens
  authHeader?: string; // default "Authorization"
  authPrefix?: string; // default "Bearer " (Sarvam uses raw key, no prefix)
};

// prettier-ignore
export const MODELS: ModelDef[] = [
  // OpenAI (native OpenAI-compatible)
  { id: "openai-gpt-4o",        label: "GPT-4o",              provider: "OpenAI",    envKey: "OPENAI_API_KEY",    baseUrl: "https://api.openai.com/v1",                        model: "gpt-4o",                                        priceIn: 2.5,  priceOut: 10 },
  { id: "openai-gpt-4o-mini",   label: "GPT-4o mini",         provider: "OpenAI",    envKey: "OPENAI_API_KEY",    baseUrl: "https://api.openai.com/v1",                        model: "gpt-4o-mini",                                   priceIn: 0.15, priceOut: 0.6 },

  // Anthropic (OpenAI-compatible endpoint)
  { id: "anthropic-opus",       label: "Claude Opus 4.8",     provider: "Anthropic", envKey: "ANTHROPIC_API_KEY", baseUrl: "https://api.anthropic.com/v1",                     model: "claude-opus-4-8",                               priceIn: 5,    priceOut: 25 },
  { id: "anthropic-sonnet",     label: "Claude Sonnet 5",     provider: "Anthropic", envKey: "ANTHROPIC_API_KEY", baseUrl: "https://api.anthropic.com/v1",                     model: "claude-sonnet-5",                               priceIn: 3,    priceOut: 15 },
  { id: "anthropic-fable",      label: "Claude Fable 5",      provider: "Anthropic", envKey: "ANTHROPIC_API_KEY", baseUrl: "https://api.anthropic.com/v1",                     model: "claude-fable-5",                                priceIn: 1,    priceOut: 5 },

  // Google Gemini (OpenAI-compatible endpoint)
  { id: "gemini-flash",         label: "Gemini 2.5 Flash",    provider: "Gemini",    envKey: "GEMINI_API_KEY",    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash",                       priceIn: 0.3,  priceOut: 2.5 },
  { id: "gemini-flash-lite",    label: "Gemini 2.5 Flash-Lite", provider: "Gemini",  envKey: "GEMINI_API_KEY",    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash-lite",                  priceIn: 0.1,  priceOut: 0.4 },
  { id: "gemini-pro",           label: "Gemini 2.5 Pro",      provider: "Gemini",    envKey: "GEMINI_API_KEY",    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-pro",                         priceIn: 1.25, priceOut: 10 },

  // Groq (LPU host)
  { id: "groq-llama-70b",       label: "Llama 3.3 70B",       provider: "Groq",      envKey: "GROQ_API_KEY",      baseUrl: "https://api.groq.com/openai/v1",                   model: "llama-3.3-70b-versatile",                       priceIn: 0.59, priceOut: 0.79 },

  // Cerebras (wafer-scale host)
  { id: "cerebras-llama-70b",   label: "Llama 3.3 70B",       provider: "Cerebras",  envKey: "CEREBRAS_API_KEY",  baseUrl: "https://api.cerebras.ai/v1",                       model: "llama-3.3-70b",                                 priceIn: 0.85, priceOut: 1.2 },

  // Together AI (open-weight host)
  { id: "together-llama-70b",   label: "Llama 3.3 70B",       provider: "Together",  envKey: "TOGETHER_API_KEY",  baseUrl: "https://api.together.xyz/v1",                      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",       priceIn: 0.88, priceOut: 0.88 },
  { id: "together-deepseek-v3", label: "DeepSeek V3",         provider: "Together",  envKey: "TOGETHER_API_KEY",  baseUrl: "https://api.together.xyz/v1",                      model: "deepseek-ai/DeepSeek-V3",                       priceIn: 1.25, priceOut: 1.25 },

  // Fireworks (open-weight host)
  { id: "fireworks-llama-70b",  label: "Llama 3.3 70B",       provider: "Fireworks", envKey: "FIREWORKS_API_KEY", baseUrl: "https://api.fireworks.ai/inference/v1",            model: "accounts/fireworks/models/llama-v3p3-70b-instruct", priceIn: 0.9, priceOut: 0.9 },

  // DeepInfra (cheapest open-weight host)
  { id: "deepinfra-llama-70b",  label: "Llama 3.3 70B",       provider: "DeepInfra", envKey: "DEEPINFRA_API_KEY", baseUrl: "https://api.deepinfra.com/v1/openai",              model: "meta-llama/Llama-3.3-70B-Instruct",             priceIn: 0.23, priceOut: 0.4 },

  // DeepSeek (first-party)
  { id: "deepseek-chat",        label: "DeepSeek Chat",       provider: "DeepSeek",  envKey: "DEEPSEEK_API_KEY",  baseUrl: "https://api.deepseek.com/v1",                      model: "deepseek-chat",                                 priceIn: 0.27, priceOut: 1.1 },

  // Sarvam (Indic-specialist; note raw-key auth header)
  { id: "sarvam-m",             label: "Sarvam-M",            provider: "Sarvam",    envKey: "SARVAM_API_KEY",    baseUrl: "https://api.sarvam.ai/v1",                         model: "sarvam-m",                                      priceIn: 0.5,  priceOut: 1.5, authHeader: "api-subscription-key", authPrefix: "" },

  // Mistral (first-party)
  { id: "mistral-large",        label: "Mistral Large",       provider: "Mistral",   envKey: "MISTRAL_API_KEY",   baseUrl: "https://api.mistral.ai/v1",                        model: "mistral-large-latest",                          priceIn: 2,    priceOut: 6 },

  // Krutrim (Indic; model id may need updating)
  { id: "krutrim-2",            label: "Krutrim-2",           provider: "Krutrim",   envKey: "KRUTRIM_API_KEY",   baseUrl: "https://cloud.olakrutrim.com/v1",                  model: "Krutrim-spectre-v2",                            priceIn: 0.2,  priceOut: 0.6 },
];

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type CallResult = {
  text: string;
  ttftMs: number | null; // time to first content token
  totalMs: number; // full round-trip
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  error?: string;
};

const TIME_CAP_MS = parseInt(process.env.LLM_TIME_CAP ?? "45") * 1000;

// Streams an OpenAI-compatible chat completion, timing TTFT + total and
// capturing token usage for cost. Never throws — returns { error } instead so
// the route can report per-model failures without failing the whole batch.
export async function callModel(
  def: ModelDef,
  messages: ChatMessage[],
): Promise<CallResult> {
  const key = process.env[def.envKey];
  const start = performance.now();
  if (!key) {
    return {
      text: "",
      ttftMs: null,
      totalMs: 0,
      promptTokens: null,
      completionTokens: null,
      costUsd: null,
      error: `Missing ${def.envKey}`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIME_CAP_MS);
  const authHeader = def.authHeader ?? "Authorization";
  const authPrefix = def.authPrefix ?? "Bearer ";

  try {
    const res = await fetch(`${def.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [authHeader]: `${authPrefix}${key}`,
      },
      body: JSON.stringify({
        model: def.model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      return {
        text: "",
        ttftMs: null,
        totalMs: performance.now() - start,
        promptTokens: null,
        completionTokens: null,
        costUsd: null,
        error: `HTTP ${res.status}: ${body.slice(0, 300)}`,
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let ttftMs: number | null = null;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep partial line
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        let json: {
          choices?: { delta?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          if (ttftMs === null) ttftMs = performance.now() - start;
          text += delta;
        }
        if (json.usage) {
          promptTokens = json.usage.prompt_tokens ?? promptTokens;
          completionTokens = json.usage.completion_tokens ?? completionTokens;
        }
      }
    }

    const totalMs = performance.now() - start;
    const costUsd =
      promptTokens !== null && completionTokens !== null
        ? (promptTokens * def.priceIn + completionTokens * def.priceOut) / 1_000_000
        : null;

    return { text, ttftMs, totalMs, promptTokens, completionTokens, costUsd };
  } catch (err) {
    const msg = (err as Error).name === "AbortError" ? "Timed out" : (err as Error).message;
    return {
      text: "",
      ttftMs: null,
      totalMs: performance.now() - start,
      promptTokens: null,
      completionTokens: null,
      costUsd: null,
      error: msg,
    };
  } finally {
    clearTimeout(timeout);
  }
}
