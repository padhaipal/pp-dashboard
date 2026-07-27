// Client-side constants + types for the database-seeding path (the button
// next to Test Models). Requests route through the pp-sketch backend:
// /api/proxy/media-meta-data/llm-generate → MediaMetaDataService →
// src/interfaces/llm/<provider>. One request = one generation (LLM call →
// validation → 100-run zero-context solvability filter → entity tree
// insert), so the dashboard fires `count` requests client-side with a small
// concurrency pool instead of one long request.

// Dashboard provider grouping → pp-sketch LLM provider id. Only these five
// are wired in pp-sketch; models from other providers can't seed.
export const SEED_PROVIDER_MAP: Record<string, string> = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  Gemini: "google",
  Mistral: "mistral",
  Sarvam: "sarvam",
};

export const SEED_MAX_COUNT = 1000;
export const SEED_CONCURRENCY = 3;
export const MAX_CUSTOM_VARS = 10;
export const VAR_NAME_MAX_CHARS = 50;
export const VAR_VALUE_MAX_CHARS = 2000;

// Hardcoded <outputSchema> presets. The selected one replaces <outputSchema>
// in the prompt. The shape MUST match pp-sketch's parseGeneratedContent
// (media-meta-data/llm-generate.dto.ts): unknown keys are dropped, the level
// is computed server-side from word count, and questions failing the
// zero-context solvability filter are rejected.
export const OUTPUT_SCHEMAS: { name: string; value: string }[] = [
  {
    name: "Comprehension MCQ (full, with TTS explanations)",
    value: `Return ONLY a JSON object, no prose, exactly this shape:
{
  "passage": {
    "text": "<the reading passage in Hindi>",
    "passage_type": "narrative" | "expository"
  },
  "questions": [
    {
      "text": "<comprehension question about the passage>",
      "question_type": "retrieve" | "infer" | "integrate" | "interpret" | "evaluate",
      "send_as_flow": true,
      "options": [
        {
          "text": "<answer option, max 300 characters>",
          "correct": true,
          "explanation": { "text": "<why this option is right/wrong>", "tts": true }
        }
      ]
    }
  ]
}
Rules: 2-4 options per question with EXACTLY one "correct": true; 1-10
questions; a question must NOT be answerable without reading the passage.`,
  },
  {
    name: "Comprehension MCQ (text-only explanations)",
    value: `Return ONLY a JSON object, no prose, exactly this shape:
{
  "passage": {
    "text": "<the reading passage in Hindi>",
    "passage_type": "narrative" | "expository"
  },
  "questions": [
    {
      "text": "<comprehension question about the passage>",
      "question_type": "retrieve" | "infer" | "integrate" | "interpret" | "evaluate",
      "send_as_flow": true,
      "options": [
        {
          "text": "<answer option, max 300 characters>",
          "correct": false,
          "explanation": { "text": "<why this option is right/wrong>", "tts": false }
        }
      ]
    }
  ]
}
Rules: 2-4 options per question with EXACTLY one "correct": true; 1-10
questions; a question must NOT be answerable without reading the passage.`,
  },
];

export type CustomVar = { name: string; value: string };

export type SeedRun =
  | { status: "running" }
  | {
      status: "created";
      passageId?: string;
      level?: number;
      questionsCreated: number;
      questionsRejected: number;
      ttsError?: string;
    }
  | { status: "rejected" | "failed"; reason: string; retriable: boolean };

// <varName> substitution. Array-valued variables (a JSON array string) rotate
// by request index: element index = requestIndex % array length. Non-array
// values (or unparseable JSON) insert verbatim.
export function substituteVariables(
  text: string,
  vars: { name: string; value: string }[],
  requestIndex: number,
): string {
  let out = text;
  for (const v of vars) {
    const name = v.name.trim();
    if (!name) continue;
    let value = v.value;
    try {
      const parsed: unknown = JSON.parse(v.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const el: unknown = parsed[requestIndex % parsed.length];
        value = typeof el === "string" ? el : JSON.stringify(el);
      }
    } catch {
      // plain string value
    }
    out = out.replaceAll(`<${name}>`, value);
  }
  return out;
}
