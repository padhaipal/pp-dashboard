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
  extraBody?: Record<string, unknown>; // merged into request (e.g. reasoning_effort to suppress <think>)
};

// prettier-ignore
export const MODELS: ModelDef[] = [
  // OpenAI (native OpenAI-compatible)
  { id: "openai-gpt-4o",         label: "GPT-4o",                provider: "OpenAI",    envKey: "OPENAI_API_KEY",    baseUrl: "https://api.openai.com/v1",                        model: "gpt-4o",                                        priceIn: 2.5,   priceOut: 10 },
  { id: "openai-gpt-4o-mini",    label: "GPT-4o mini",           provider: "OpenAI",    envKey: "OPENAI_API_KEY",    baseUrl: "https://api.openai.com/v1",                        model: "gpt-4o-mini",                                   priceIn: 0.15,  priceOut: 0.6 },
  { id: "openai-gpt-4.1",        label: "GPT-4.1",               provider: "OpenAI",    envKey: "OPENAI_API_KEY",    baseUrl: "https://api.openai.com/v1",                        model: "gpt-4.1",                                       priceIn: 2,     priceOut: 8 },
  { id: "openai-gpt-4.1-mini",   label: "GPT-4.1 mini",          provider: "OpenAI",    envKey: "OPENAI_API_KEY",    baseUrl: "https://api.openai.com/v1",                        model: "gpt-4.1-mini",                                  priceIn: 0.4,   priceOut: 1.6 },
  { id: "openai-gpt-4.1-nano",   label: "GPT-4.1 nano",          provider: "OpenAI",    envKey: "OPENAI_API_KEY",    baseUrl: "https://api.openai.com/v1",                        model: "gpt-4.1-nano",                                  priceIn: 0.1,   priceOut: 0.4 },
  { id: "openai-gpt-4o-mini-2",  label: "o4-mini",               provider: "OpenAI",    envKey: "OPENAI_API_KEY",    baseUrl: "https://api.openai.com/v1",                        model: "o4-mini",                                       priceIn: 1.1,   priceOut: 4.4, extraBody: { reasoning_effort: "low" } },

  // Anthropic (OpenAI-compatible endpoint)
  { id: "anthropic-opus",        label: "Claude Opus 4.8",       provider: "Anthropic", envKey: "ANTHROPIC_API_KEY", baseUrl: "https://api.anthropic.com/v1",                     model: "claude-opus-4-8",                               priceIn: 5,     priceOut: 25 },
  { id: "anthropic-sonnet",      label: "Claude Sonnet 5",       provider: "Anthropic", envKey: "ANTHROPIC_API_KEY", baseUrl: "https://api.anthropic.com/v1",                     model: "claude-sonnet-5",                               priceIn: 3,     priceOut: 15 },
  { id: "anthropic-fable",       label: "Claude Fable 5",        provider: "Anthropic", envKey: "ANTHROPIC_API_KEY", baseUrl: "https://api.anthropic.com/v1",                     model: "claude-fable-5",                                priceIn: 1,     priceOut: 5 },
  { id: "anthropic-haiku",       label: "Claude Haiku 4.5",      provider: "Anthropic", envKey: "ANTHROPIC_API_KEY", baseUrl: "https://api.anthropic.com/v1",                     model: "claude-haiku-4-5-20251001",                     priceIn: 0.8,   priceOut: 4 },

  // Google Gemini (OpenAI-compatible endpoint)
  { id: "gemini-flash",          label: "Gemini Flash (latest)", provider: "Gemini",    envKey: "GEMINI_API_KEY",    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-flash-latest",                    priceIn: 0.3,   priceOut: 2.5 },
  { id: "gemini-flash-lite",     label: "Gemini Flash-Lite (latest)", provider: "Gemini", envKey: "GEMINI_API_KEY",  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-flash-lite-latest",               priceIn: 0.1,   priceOut: 0.4 },
  { id: "gemini-pro",            label: "Gemini 2.5 Pro",        provider: "Gemini",    envKey: "GEMINI_API_KEY",    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-pro",                         priceIn: 1.25,  priceOut: 10 },

  // xAI Grok (native OpenAI-compatible)
  { id: "xai-grok-4",            label: "Grok 4",                provider: "xAI",       envKey: "XAI_API_KEY",       baseUrl: "https://api.x.ai/v1",                              model: "grok-4",                                        priceIn: 3,     priceOut: 15 },
  { id: "xai-grok-3",            label: "Grok 3",                provider: "xAI",       envKey: "XAI_API_KEY",       baseUrl: "https://api.x.ai/v1",                              model: "grok-3",                                        priceIn: 3,     priceOut: 15 },
  { id: "xai-grok-3-mini",       label: "Grok 3 mini",           provider: "xAI",       envKey: "XAI_API_KEY",       baseUrl: "https://api.x.ai/v1",                              model: "grok-3-mini",                                   priceIn: 0.3,   priceOut: 0.5 },

  // Groq (LPU host — fast + free tier; cheap small models)
  { id: "groq-llama-8b",         label: "Llama 3.1 8B Instant",  provider: "Groq",      envKey: "GROQ_API_KEY",      baseUrl: "https://api.groq.com/openai/v1",                   model: "llama-3.1-8b-instant",                          priceIn: 0.05,  priceOut: 0.08 },
  { id: "groq-llama-70b",        label: "Llama 3.3 70B",         provider: "Groq",      envKey: "GROQ_API_KEY",      baseUrl: "https://api.groq.com/openai/v1",                   model: "llama-3.3-70b-versatile",                       priceIn: 0.59,  priceOut: 0.79 },
  { id: "groq-qwen3-32b",        label: "Qwen3 32B",             provider: "Groq",      envKey: "GROQ_API_KEY",      baseUrl: "https://api.groq.com/openai/v1",                   model: "qwen/qwen3-32b",                                priceIn: 0.29,  priceOut: 0.59, extraBody: { reasoning_effort: "none" } },
  { id: "groq-gpt-oss-20b",      label: "gpt-oss 20B",           provider: "Groq",      envKey: "GROQ_API_KEY",      baseUrl: "https://api.groq.com/openai/v1",                   model: "openai/gpt-oss-20b",                            priceIn: 0.1,   priceOut: 0.5, extraBody: { reasoning_effort: "low" } },
  { id: "groq-gpt-oss-120b",     label: "gpt-oss 120B",          provider: "Groq",      envKey: "GROQ_API_KEY",      baseUrl: "https://api.groq.com/openai/v1",                   model: "openai/gpt-oss-120b",                           priceIn: 0.15,  priceOut: 0.75, extraBody: { reasoning_effort: "low" } },

  // Cerebras (wafer-scale host — fastest throughput + free tier)
  // NOTE: this account's Cerebras tier only serves gpt-oss-120b; llama/qwen 404'd
  // as "no access". Re-add them here if you upgrade tier (ids: llama3.1-8b,
  // llama-4-scout-17b-16e-instruct, qwen-3-235b-a22b-instruct-2507).
  { id: "cerebras-gpt-oss-120b", label: "gpt-oss 120B",          provider: "Cerebras",  envKey: "CEREBRAS_API_KEY",  baseUrl: "https://api.cerebras.ai/v1",                       model: "gpt-oss-120b",                                  priceIn: 0.25,  priceOut: 0.69 },

  // Together AI (open-weight host)
  { id: "together-llama-8b",     label: "Llama 3.1 8B Turbo",    provider: "Together",  envKey: "TOGETHER_API_KEY",  baseUrl: "https://api.together.xyz/v1",                      model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",   priceIn: 0.18,  priceOut: 0.18 },
  { id: "together-llama-70b",    label: "Llama 3.3 70B Turbo",   provider: "Together",  envKey: "TOGETHER_API_KEY",  baseUrl: "https://api.together.xyz/v1",                      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",       priceIn: 0.88,  priceOut: 0.88 },
  { id: "together-qwen25-7b",    label: "Qwen 2.5 7B Turbo",     provider: "Together",  envKey: "TOGETHER_API_KEY",  baseUrl: "https://api.together.xyz/v1",                      model: "Qwen/Qwen2.5-7B-Instruct-Turbo",                priceIn: 0.3,   priceOut: 0.3 },
  { id: "together-deepseek-v3",  label: "DeepSeek V3",           provider: "Together",  envKey: "TOGETHER_API_KEY",  baseUrl: "https://api.together.xyz/v1",                      model: "deepseek-ai/DeepSeek-V3",                       priceIn: 1.25,  priceOut: 1.25 },

  // Fireworks (open-weight host)
  { id: "fireworks-llama-8b",    label: "Llama 3.1 8B",          provider: "Fireworks", envKey: "FIREWORKS_API_KEY", baseUrl: "https://api.fireworks.ai/inference/v1",            model: "accounts/fireworks/models/llama-v3p1-8b-instruct",  priceIn: 0.2,  priceOut: 0.2 },
  { id: "fireworks-llama-70b",   label: "Llama 3.3 70B",         provider: "Fireworks", envKey: "FIREWORKS_API_KEY", baseUrl: "https://api.fireworks.ai/inference/v1",            model: "accounts/fireworks/models/llama-v3p3-70b-instruct", priceIn: 0.9,  priceOut: 0.9 },
  { id: "fireworks-qwen25-7b",   label: "Qwen 2.5 7B",           provider: "Fireworks", envKey: "FIREWORKS_API_KEY", baseUrl: "https://api.fireworks.ai/inference/v1",            model: "accounts/fireworks/models/qwen2p5-7b-instruct",     priceIn: 0.2,  priceOut: 0.2 },

  // DeepInfra (cheapest open-weight host)
  { id: "deepinfra-llama-8b",    label: "Llama 3.1 8B",          provider: "DeepInfra", envKey: "DEEPINFRA_API_KEY", baseUrl: "https://api.deepinfra.com/v1/openai",              model: "meta-llama/Meta-Llama-3.1-8B-Instruct",         priceIn: 0.03,  priceOut: 0.05 },
  { id: "deepinfra-llama-70b",   label: "Llama 3.3 70B",         provider: "DeepInfra", envKey: "DEEPINFRA_API_KEY", baseUrl: "https://api.deepinfra.com/v1/openai",              model: "meta-llama/Llama-3.3-70B-Instruct",             priceIn: 0.23,  priceOut: 0.4 },
  { id: "deepinfra-qwen25-7b",   label: "Qwen 2.5 7B",           provider: "DeepInfra", envKey: "DEEPINFRA_API_KEY", baseUrl: "https://api.deepinfra.com/v1/openai",              model: "Qwen/Qwen2.5-7B-Instruct",                      priceIn: 0.05,  priceOut: 0.1 },

  // DeepSeek (first-party)
  { id: "deepseek-chat",         label: "DeepSeek Chat",         provider: "DeepSeek",  envKey: "DEEPSEEK_API_KEY",  baseUrl: "https://api.deepseek.com/v1",                      model: "deepseek-chat",                                 priceIn: 0.27,  priceOut: 1.1 },
  { id: "deepseek-reasoner",     label: "DeepSeek Reasoner",     provider: "DeepSeek",  envKey: "DEEPSEEK_API_KEY",  baseUrl: "https://api.deepseek.com/v1",                      model: "deepseek-reasoner",                             priceIn: 0.55,  priceOut: 2.19 },

  // Sarvam (Indic-specialist; note raw-key auth header)
  // reasoning_effort: null disables Sarvam's default "thinking" mode, which
  // otherwise consumes the whole 2048 max_tokens budget before emitting an answer.
  { id: "sarvam-30b",            label: "Sarvam 30B",            provider: "Sarvam",    envKey: "SARVAM_API_KEY",    baseUrl: "https://api.sarvam.ai/v1",                         model: "sarvam-30b",                                    priceIn: 0.5,   priceOut: 1.5, authHeader: "api-subscription-key", authPrefix: "", extraBody: { reasoning_effort: null } },
  { id: "sarvam-105b",           label: "Sarvam 105B",           provider: "Sarvam",    envKey: "SARVAM_API_KEY",    baseUrl: "https://api.sarvam.ai/v1",                         model: "sarvam-105b",                                   priceIn: 1,     priceOut: 3, authHeader: "api-subscription-key", authPrefix: "", extraBody: { reasoning_effort: null } },

  // Mistral (first-party; cheap Ministral small models)
  { id: "mistral-large",         label: "Mistral Large",         provider: "Mistral",   envKey: "MISTRAL_API_KEY",   baseUrl: "https://api.mistral.ai/v1",                        model: "mistral-large-latest",                          priceIn: 2,     priceOut: 6 },
  { id: "mistral-small",         label: "Mistral Small",         provider: "Mistral",   envKey: "MISTRAL_API_KEY",   baseUrl: "https://api.mistral.ai/v1",                        model: "mistral-small-latest",                          priceIn: 0.2,   priceOut: 0.6 },
  { id: "mistral-ministral-8b",  label: "Ministral 8B",          provider: "Mistral",   envKey: "MISTRAL_API_KEY",   baseUrl: "https://api.mistral.ai/v1",                        model: "ministral-8b-latest",                           priceIn: 0.1,   priceOut: 0.1 },
  { id: "mistral-ministral-3b",  label: "Ministral 3B",          provider: "Mistral",   envKey: "MISTRAL_API_KEY",   baseUrl: "https://api.mistral.ai/v1",                        model: "ministral-3b-latest",                           priceIn: 0.04,  priceOut: 0.04 },
  { id: "mistral-nemo",          label: "Mistral NeMo",          provider: "Mistral",   envKey: "MISTRAL_API_KEY",   baseUrl: "https://api.mistral.ai/v1",                        model: "open-mistral-nemo",                             priceIn: 0.15,  priceOut: 0.15 },

  // Krutrim (Indic; model ids may need updating)
  { id: "krutrim-2",             label: "Krutrim-2",             provider: "Krutrim",   envKey: "KRUTRIM_API_KEY",   baseUrl: "https://cloud.olakrutrim.com/v1",                  model: "Krutrim-spectre-v2",                            priceIn: 0.2,   priceOut: 0.6 },
  { id: "krutrim-llama-8b",      label: "Llama 3.1 8B",          provider: "Krutrim",   envKey: "KRUTRIM_API_KEY",   baseUrl: "https://cloud.olakrutrim.com/v1",                  model: "Meta-Llama-3.1-8B-Instruct",                    priceIn: 0.1,   priceOut: 0.1 },
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
        ...def.extraBody,
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
    let reasoning = ""; // delta.reasoning_content (thinking models: DeepSeek R1, Sarvam, …)
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
          choices?: { delta?: { content?: string; reasoning_content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = json.choices?.[0]?.delta;
        // TTFT = first token of either the answer OR the reasoning stream.
        if (delta?.content) {
          if (ttftMs === null) ttftMs = performance.now() - start;
          text += delta.content;
        }
        if (delta?.reasoning_content) {
          if (ttftMs === null) ttftMs = performance.now() - start;
          reasoning += delta.reasoning_content;
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

    // If the model only emitted reasoning (hit max_tokens before answering),
    // surface the reasoning so the card isn't blank.
    const finalText =
      text.length > 0
        ? text
        : reasoning.length > 0
          ? `[reasoning only — no answer returned]\n${reasoning}`
          : text;

    return { text: finalText, ttftMs, totalMs, promptTokens, completionTokens, costUsd };
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
