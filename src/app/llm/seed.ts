// Client-side constants + types for the database-seeding path (the button
// next to Test Models). Requests route through the pp-sketch backend:
// /api/proxy/media-meta-data/llm-generate → MediaMetaDataService →
// src/interfaces/llm/<provider>. One request = one generation (LLM call →
// validation → passage-judge gate (10 valid runs over ≤14 calls) →
// zero-context solvability filter (144 valid runs over ≤300 calls) → entity
// tree insert of ONE passage with ONE question), so the dashboard fires
// `count` requests client-side with a small concurrency pool instead of one
// long request.

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

// Reading subconstructs from "SDG 4.1.1 Minimum Proficiency Levels:
// Definition and blueprint for assessment" (ACER GEM / UNESCO UIS, p. 26,
// https://research.acer.edu.au/cgi/viewcontent.cgi?article=1025&context=gem —
// source of the descriptions below). One JSON template per subconstruct; the
// question_type is pinned inside the template. Used to build the
// <outputSchema> dropdown labels.
export const QUESTION_TYPE_INFO: { code: string; description: string }[] = [
  { code: "R1.1", description: "Recognise the meaning of common Grade-level words" },
  {
    code: "R1.2",
    description:
      "Retrieve explicit information in a Grade-level continuous text by direct or close word matching",
  },
  {
    code: "R1.3",
    description:
      "Retrieve explicit information in a Grade-level text by synonymous word matching",
  },
  {
    code: "R2.1",
    description:
      "Identify the meaning of unknown words and expressions in a Grade-level text",
  },
  { code: "R2.2", description: "Make inferences in a Grade-level text" },
  {
    code: "R2.3",
    description: "Identify the main and secondary ideas in a Grade-level text",
  },
  { code: "R3.1", description: "Identify the purpose and audience of a text" },
  { code: "R3.2", description: "Evaluate a text with justification" },
];


// One <outputSchema> preset per question type. The shape MUST match
// pp-sketch's parseGeneratedContent (media-meta-data/llm-generate.dto.ts):
// exactly one passage + one question, unknown keys are dropped, the level is
// computed server-side from word count, every text entity is converted to
// audio, and questions failing the passage-judge or zero-context solvability
// gate are soft-deleted.
function schemaFor(code: string, description: string): string {
  return `Return ONLY a JSON object, no prose, exactly this shape:
{
  "passage": {
    "text": "<the reading passage in Hindi>",
    "passage_type": "narrative" | "expository"
  },
  "question": {
    "text": "<comprehension question about the passage>",
    "question_type": "${code}",
    "send_as_flow": true,
    "options": [
      {
        "text": "<answer option, max 300 characters>",
        "correct": true,
        "explanation": { "text": "<why this option is right/wrong>" }
      }
    ]
  }
}
Rules: exactly ONE question with "question_type": "${code}"; the question must
test this skill: "${description}"; 2-4 options with EXACTLY one
"correct": true; every option needs an explanation; the question must NOT be
answerable without reading the passage.`;
}

export const OUTPUT_SCHEMAS: { name: string; value: string }[] =
  QUESTION_TYPE_INFO.map(({ code, description }) => ({
    name: `${code} — ${description}`,
    value: schemaFor(code, description),
  }));

export type CustomVar = { name: string; value: string };

export type SeedRun =
  | { status: "running" }
  | {
      status: "created";
      passageId?: string;
      level?: number;
      ttsError?: string;
    }
  | {
      status: "rejected" | "failed";
      reason: string;
      retriable: boolean;
      // 'discarded' = persisted soft-deleted with a gate_failure record
      // (visible under Filter failures); 'unverified' = nothing written,
      // retry may succeed.
      questionStatus?: string;
    };

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
