"use client";

import { useMemo, useState } from "react";
import type { CallResult, ChatMessage } from "./models";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "./default-prompts";
import {
  MAX_CUSTOM_VARS,
  OUTPUT_SCHEMAS,
  SEED_CONCURRENCY,
  SEED_MAX_COUNT,
  SEED_PROVIDER_MAP,
  VAR_NAME_MAX_CHARS,
  VAR_VALUE_MAX_CHARS,
  substituteVariables,
  type CustomVar,
  type SeedRun,
} from "./seed";
import { GenerationFailures } from "./generation-failures";

export type ClientModel = {
  id: string;
  label: string;
  provider: string;
  envKey: string;
  // Provider-native model id (e.g. "gpt-4.1") — what pp-sketch's seeding
  // endpoint expects.
  model: string;
  priceIn: number;
  priceOut: number;
  available: boolean;
};

type Row = { role: ChatMessage["role"]; content: string };

type ResultState =
  | { status: "loading" }
  | { status: "done"; data: CallResult };

type SummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unavailable" } // judge model's API key not set
  | { status: "done"; data: CallResult };

// The model that judges/summarizes the others (see models.ts). Requires its API key.
const JUDGE_MODEL_ID = "openai-gpt-4.1";
const JUDGE_MODEL_NAME = "GPT-4.1";

// Editable template. <LLM prompt> and <LLM responses> are substituted at call time.
const DEFAULT_JUDGE_PROMPT = `You are evaluating responses from several different LLMs that were all given the SAME prompt.

The prompt that was sent to every model:
<LLM prompt>

Each model's response, with its measured latency and cost:
<LLM responses>

Decide:
1. HIGHEST QUALITY — which single response is best on quality alone (ignore latency and cost). Name the model and explain briefly.
2. BEST OVERALL — which response is best balancing quality, latency, and cost. Name the model and justify the trade-off.
3. Then please make suggestions to the original prompt to correct for the most common sources of errors and generally what would increase the quality and consistency of the LLM responses.

Keep it concise.`;

// The judge bundles the original prompt + every response into ONE call, which
// can blow the judge model's tokens-per-minute limit (e.g. GPT-4.1 at 30k TPM).
// Cap the character budget so the request stays well under it (~1 token ≈ 4 chars).
const JUDGE_PROMPT_CHAR_BUDGET = 6000; // ~1.5k tokens for the original prompt copy
const JUDGE_RESPONSES_CHAR_BUDGET = 32000; // ~8k tokens shared across all responses

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}\n… [truncated ${s.length - max} chars]`;
}

function formatSentPrompt(messages: ChatMessage[]): string {
  const joined = messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n");
  return truncate(joined, JUDGE_PROMPT_CHAR_BUDGET);
}

function formatResponses(items: { label: string; data: CallResult }[]): string {
  // Split the response budget evenly across models so many selections still fit.
  const perResponse = Math.max(400, Math.floor(JUDGE_RESPONSES_CHAR_BUDGET / Math.max(1, items.length)));
  return items
    .map(({ label, data }) => {
      const ttft = data.ttftMs !== null ? `TTFT ${Math.round(data.ttftMs)}ms, ` : "";
      const cost = data.costUsd !== null ? `, cost $${data.costUsd.toFixed(5)}` : "";
      return `### ${label} (${ttft}total ${Math.round(data.totalMs)}ms${cost})\n${truncate(data.text, perResponse)}`;
    })
    .join("\n\n");
}

function fillJudgePrompt(template: string, promptText: string, responsesText: string): string {
  return template
    .replaceAll("<LLM prompt>", promptText)
    .replaceAll("<LLM responses>", responsesText);
}

export function LlmConsole({ models }: { models: ClientModel[] }) {
  const [system, setSystem] = useState(DEFAULT_SYSTEM_PROMPT);
  const [rows, setRows] = useState<Row[]>([{ role: "user", content: DEFAULT_USER_PROMPT }]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, ResultState>>({});
  const [running, setRunning] = useState(false);
  const [language, setLanguage] = useState<"english" | "hindi">("english");
  const [judgePrompt, setJudgePrompt] = useState(DEFAULT_JUDGE_PROMPT);
  const [summary, setSummary] = useState<SummaryState>({ status: "idle" });

  // ── Seeding state (the pp-sketch-backed path) ──
  const [outputSchemaName, setOutputSchemaName] = useState(OUTPUT_SCHEMAS[0].name);
  const [customVars, setCustomVars] = useState<CustomVar[]>([]);
  const [count, setCount] = useState(1);
  const [seedModelId, setSeedModelId] = useState<string>("");
  const [seedStates, setSeedStates] = useState<SeedRun[]>([]);
  const [seeding, setSeeding] = useState(false);

  const judgeModel = useMemo(() => models.find((m) => m.id === JUDGE_MODEL_ID), [models]);

  // Models whose provider is wired in pp-sketch's interfaces/llm — the only
  // ones the seed endpoint accepts.
  const seedableModels = useMemo(
    () => models.filter((m) => m.available && SEED_PROVIDER_MAP[m.provider]),
    [models],
  );

  const grouped = useMemo(() => {
    const byProvider = new Map<string, ClientModel[]>();
    for (const m of models) {
      const list = byProvider.get(m.provider) ?? [];
      list.push(m);
      byProvider.set(m.provider, list);
    }
    return [...byProvider.entries()];
  }, [models]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const availableIds = useMemo(
    () => models.filter((m) => m.available).map((m) => m.id),
    [models],
  );

  function selectAll() {
    setSelected(new Set(availableIds));
  }

  function clearAll() {
    setSelected(new Set());
  }

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { role: prev[prev.length - 1]?.role === "user" ? "assistant" : "user", content: "" },
    ]);
  }

  function removeRow(i: number) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  // Chat-completions has no `language` body field (unlike STT), so the toggle
  // enforces language by injecting a dedicated structured system message into
  // the messages[] payload — part of the request JSON, not manual prompt text.
  const HINDI_DIRECTIVE =
    "Respond entirely in Hindi (हिन्दी) using Devanagari script. Every word of your output must be in Hindi. Do not use English.";

  // requestIndex drives array-variable rotation across a seed batch. Test
  // Models always uses index 0.
  function buildMessages(requestIndex = 0): ChatMessage[] {
    const allVars: CustomVar[] = [
      {
        name: "outputSchema",
        value:
          OUTPUT_SCHEMAS.find((s) => s.name === outputSchemaName)?.value ??
          OUTPUT_SCHEMAS[0].value,
      },
      ...customVars,
    ];
    const sub = (text: string) => substituteVariables(text, allVars, requestIndex);
    const msgs: ChatMessage[] = [];
    if (language === "hindi") msgs.push({ role: "system", content: HINDI_DIRECTIVE });
    if (system.trim()) msgs.push({ role: "system", content: sub(system) });
    for (const r of rows) if (r.content.trim()) msgs.push({ role: r.role, content: sub(r.content) });
    return msgs;
  }

  function setCustomVar(i: number, patch: Partial<CustomVar>) {
    setCustomVars((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  function addCustomVar() {
    setCustomVars((prev) =>
      prev.length >= MAX_CUSTOM_VARS ? prev : [...prev, { name: "", value: "" }],
    );
  }

  function removeCustomVar(i: number) {
    setCustomVars((prev) => prev.filter((_, idx) => idx !== i));
  }

  function setSeedRun(i: number, run: SeedRun) {
    setSeedStates((prev) => prev.map((s, idx) => (idx === i ? run : s)));
  }

  // One generation per request: LLM call → validation → passage-judge gate →
  // solvability filter → insert (one passage, one question). Slow by nature
  // (~2-3 min for the 10+144 gate runs).
  async function runSeedRequest(model: ClientModel, provider: string, i: number) {
    setSeedRun(i, { status: "running" });
    try {
      const res = await fetch("/api/proxy/media-meta-data/llm-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model: model.model,
          messages: buildMessages(i),
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        status?: string;
        reason?: string;
        retriable?: boolean;
        passage_id?: string;
        level?: number;
        tts_error?: string;
        question?: { status: string; reason?: string };
        message?: string;
      } | null;
      if (!res.ok || !json?.status) {
        setSeedRun(i, {
          status: "failed",
          reason: json?.message ?? json?.reason ?? `HTTP ${res.status}`,
          retriable: true,
        });
        return;
      }
      if (json.status === "created") {
        setSeedRun(i, {
          status: "created",
          passageId: json.passage_id,
          level: json.level,
          ttsError: json.tts_error,
        });
      } else {
        setSeedRun(i, {
          status: json.status === "rejected" ? "rejected" : "failed",
          reason: json.reason ?? "unknown",
          retriable: json.retriable === true,
          questionStatus: json.question?.status,
        });
      }
    } catch (err) {
      setSeedRun(i, { status: "failed", reason: (err as Error).message, retriable: true });
    }
  }

  async function seed() {
    const model = modelById.get(seedModelId);
    if (!model) return;
    const provider = SEED_PROVIDER_MAP[model.provider];
    if (!provider) return;
    const n = Math.min(Math.max(Math.round(count) || 1, 1), SEED_MAX_COUNT);

    setSeeding(true);
    setSeedStates(Array.from({ length: n }, () => ({ status: "running" })));
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(SEED_CONCURRENCY, n) }, async () => {
        while (next < n) {
          const i = next++;
          await runSeedRequest(model, provider, i);
        }
      }),
    );
    setSeeding(false);
  }

  async function retrySeed(i: number) {
    const model = modelById.get(seedModelId);
    if (!model) return;
    const provider = SEED_PROVIDER_MAP[model.provider];
    if (!provider) return;
    await runSeedRequest(model, provider, i);
  }

  async function start() {
    const messages = buildMessages();
    const ids = [...selected];
    if (messages.length === 0 || ids.length === 0) return;

    setRunning(true);
    setSummary({ status: "idle" });
    setResults(Object.fromEntries(ids.map((id) => [id, { status: "loading" }])));

    // Fire all in parallel; each card updates the moment its model responds.
    // Also collect into `local` so the judge sees final data without a stale
    // closure over `results` state.
    const local: Record<string, CallResult> = {};
    await Promise.all(
      ids.map(async (id) => {
        let data: CallResult;
        try {
          const res = await fetch("/api/llm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modelId: id, messages }),
          });
          data = res.ok
            ? await res.json()
            : { ...emptyResult(), error: (await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}` };
        } catch (err) {
          data = { ...emptyResult(), error: (err as Error).message };
        }
        local[id] = data;
        setResults((prev) => ({ ...prev, [id]: { status: "done", data } }));
      }),
    );

    // After every model has responded or timed out, ask the judge model to rank them.
    const completed = ids
      .map((id) => ({ m: modelById.get(id), data: local[id] }))
      .filter(
        (x): x is { m: ClientModel; data: CallResult } =>
          !!x.m && !!x.data && !x.data.error && x.data.text.trim().length > 0,
      );

    if (completed.length === 0) {
      setRunning(false);
      return; // nothing to summarize
    }
    if (!judgeModel?.available) {
      setSummary({ status: "unavailable" });
      setRunning(false);
      return;
    }

    setSummary({ status: "loading" });
    const filled = fillJudgePrompt(
      judgePrompt,
      formatSentPrompt(messages),
      formatResponses(completed.map((c) => ({ label: `${c.m.provider} · ${c.m.label}`, data: c.data }))),
    );
    let judgeData: CallResult;
    try {
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: JUDGE_MODEL_ID, messages: [{ role: "user", content: filled }] }),
      });
      judgeData = res.ok
        ? await res.json()
        : { ...emptyResult(), error: (await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}` };
    } catch (err) {
      judgeData = { ...emptyResult(), error: (err as Error).message };
    }
    setSummary({ status: "done", data: judgeData });
    setRunning(false);
  }

  const modelById = new Map(models.map((m) => [m.id, m]));
  const orderedResults = [...selected].filter((id) => results[id]);

  // Non-blocking pre-send check: any <word> token still present in the final
  // (substituted) prompt that matches no defined variable and is not
  // <outputSchema> is probably a typo or a missing variable.
  const unmatchedTokens = (() => {
    const defined = new Set([
      "outputSchema",
      ...customVars.map((v) => v.name.trim()).filter(Boolean),
    ]);
    const tokens = new Set<string>();
    for (const m of buildMessages()) {
      for (const match of m.content.matchAll(/<(\w+)>/g)) {
        if (!defined.has(match[1])) tokens.add(match[1]);
      }
    }
    return [...tokens];
  })();

  // Bars for the latency + cost graphs: only completed, error-free numeric
  // results. Sorted ascending (fastest / cheapest first).
  const chartData = (() => {
    const latency: { id: string; label: string; value: number }[] = [];
    const cost: { id: string; label: string; value: number }[] = [];
    for (const id of [...selected]) {
      const st = results[id];
      const m = modelById.get(id);
      if (!m || st?.status !== "done" || st.data.error) continue;
      const label = `${m.provider} · ${m.label}`;
      if (st.data.totalMs > 0) latency.push({ id, label, value: st.data.totalMs });
      if (st.data.costUsd !== null) cost.push({ id, label, value: st.data.costUsd });
    }
    latency.sort((a, b) => a.value - b.value);
    cost.sort((a, b) => a.value - b.value);
    return { latency, cost };
  })();

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-semibold text-zinc-900 mb-1">LLM Playground</h1>
        <p className="text-sm text-zinc-500 mb-6">
          Compare quality, latency (TTFT + total) and cost across models. Greyed models need their
          API key set in Railway.
        </p>

        {/* Response language toggle — injects a Hindi directive into messages[] */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-700 mb-1">Response language</label>
          <div className="inline-flex rounded border border-zinc-300 overflow-hidden text-sm">
            <button
              onClick={() => setLanguage("english")}
              className={`px-3 py-1.5 ${
                language === "english" ? "bg-blue-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLanguage("hindi")}
              className={`px-3 py-1.5 border-l border-zinc-300 ${
                language === "hindi" ? "bg-blue-600 text-white" : "bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              हिन्दी Hindi
            </button>
          </div>
          {language === "hindi" && (
            <p className="mt-1 text-xs text-zinc-500">
              A Hindi system message is prepended to the messages[] payload.
            </p>
          )}
        </div>

        {/* System */}
        <label className="block text-sm font-medium text-zinc-700 mb-1">System message</label>
        <textarea
          value={system}
          onChange={(e) => setSystem(e.target.value)}
          rows={2}
          placeholder="Optional. e.g. You are a helpful Hindi tutor."
          className="w-full mb-4 rounded border border-zinc-300 p-2 text-sm text-zinc-900 resize-y min-h-[2.5rem]"
        />

        {/* Messages */}
        <label className="block text-sm font-medium text-zinc-700 mb-1">Messages</label>
        <div className="space-y-2 mb-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2 items-start">
              <select
                value={r.role}
                onChange={(e) => setRow(i, { role: e.target.value as Row["role"] })}
                className="rounded border border-zinc-300 p-2 text-sm text-zinc-900 bg-white"
              >
                <option value="user">user</option>
                <option value="assistant">assistant</option>
                <option value="system">system</option>
              </select>
              <textarea
                value={r.content}
                onChange={(e) => setRow(i, { content: e.target.value })}
                rows={2}
                placeholder="Message content…"
                className="flex-1 rounded border border-zinc-300 p-2 text-sm text-zinc-900 resize-y min-h-[2.5rem]"
              />
              <button
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                className="px-2 py-2 text-sm text-zinc-500 hover:text-red-600 disabled:opacity-30"
                aria-label="Remove message"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button onClick={addRow} className="text-sm text-blue-600 hover:underline mb-6">
          + Add message
        </button>

        {/* Prompt variables — <varName> placeholders substituted into the
            system message + all message rows before sending */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-700 mb-1">Prompt variables</label>
          <p className="text-xs text-zinc-500 mb-2">
            Enter the name only — no angle brackets. Reference it in the prompt
            as <code className="rounded bg-zinc-100 px-1">&lt;name&gt;</code>.{" "}
            <code className="rounded bg-zinc-100 px-1">&lt;outputSchema&gt;</code> is built in — pick a
            preset below. A value that is a JSON array rotates per request in a seed batch (element ={" "}
            <code className="rounded bg-zinc-100 px-1">requestIndex % length</code>, wrapping); Test
            Models always uses the first element.
          </p>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono text-zinc-600 w-32 shrink-0">&lt;outputSchema&gt;</span>
            <select
              value={outputSchemaName}
              onChange={(e) => setOutputSchemaName(e.target.value)}
              className="flex-1 rounded border border-zinc-300 p-2 text-sm text-zinc-900 bg-white"
            >
              {OUTPUT_SCHEMAS.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 mb-2">
            {customVars.map((v, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  value={v.name}
                  maxLength={VAR_NAME_MAX_CHARS}
                  // Strip angle brackets so a pasted <topic> stores as topic.
                  onChange={(e) =>
                    setCustomVar(i, {
                      name: e.target.value.replace(/[<>]/g, ""),
                    })
                  }
                  placeholder="varName"
                  className="w-32 shrink-0 rounded border border-zinc-300 p-2 text-sm font-mono text-zinc-900"
                />
                <textarea
                  value={v.value}
                  maxLength={VAR_VALUE_MAX_CHARS}
                  onChange={(e) => setCustomVar(i, { value: e.target.value })}
                  rows={1}
                  placeholder='Value — plain text, or a JSON array like ["जंगल","नदी"] to rotate per request'
                  className="flex-1 rounded border border-zinc-300 p-2 text-sm text-zinc-900 resize-y min-h-[2.5rem]"
                />
                <button
                  onClick={() => removeCustomVar(i)}
                  className="px-2 py-2 text-sm text-zinc-500 hover:text-red-600"
                  aria-label="Remove variable"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addCustomVar}
            disabled={customVars.length >= MAX_CUSTOM_VARS}
            className="text-sm text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline"
          >
            + Add variable{customVars.length >= MAX_CUSTOM_VARS ? ` (max ${MAX_CUSTOM_VARS})` : ""}
          </button>
          {unmatchedTokens.length > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              Warning: {unmatchedTokens.map((t) => `<${t}>`).join(", ")}{" "}
              {unmatchedTokens.length === 1 ? "matches" : "match"} no defined
              variable and will be sent as-is.
            </p>
          )}
        </div>

        {/* Model checkboxes */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <label className="text-sm font-medium text-zinc-700">Models to test</label>
            <button
              onClick={selectAll}
              disabled={availableIds.length === 0}
              className="text-xs text-blue-600 hover:underline disabled:opacity-40"
            >
              Select all
            </button>
            <button
              onClick={clearAll}
              disabled={selected.size === 0}
              className="text-xs text-zinc-500 hover:underline disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            {grouped.map(([provider, list]) => (
              <div key={provider}>
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                  {provider}
                </div>
                {list.map((m) => (
                  <label
                    key={m.id}
                    title={m.available ? `$${m.priceIn}/$${m.priceOut} per 1M tok` : `Set ${m.envKey} in Railway`}
                    className={`flex items-center gap-2 text-sm py-0.5 ${
                      m.available ? "text-zinc-800 cursor-pointer" : "text-zinc-400 cursor-not-allowed"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!m.available}
                      checked={selected.has(m.id)}
                      onChange={() => toggle(m.id)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Judge prompt — sent to the judge model after all responses settle */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Summary judge prompt ({JUDGE_MODEL_NAME})
          </label>
          <p className="text-xs text-zinc-500 mb-1">
            After every model responds, this is sent to {JUDGE_MODEL_NAME}.{" "}
            <code className="rounded bg-zinc-100 px-1">&lt;LLM prompt&gt;</code> is replaced with the
            prompt sent to the models;{" "}
            <code className="rounded bg-zinc-100 px-1">&lt;LLM responses&gt;</code> with every model&apos;s
            response plus its latency and cost.
            {!judgeModel?.available &&
              ` Set ${judgeModel?.envKey ?? "the judge model's API key"} in Railway to enable.`}
          </p>
          <textarea
            value={judgePrompt}
            onChange={(e) => setJudgePrompt(e.target.value)}
            rows={7}
            className="w-full rounded border border-zinc-300 p-2 text-sm text-zinc-900 font-mono resize-y min-h-[4rem]"
          />
        </div>

        {/* Seed the database via pp-sketch (media-metadata → interfaces/llm) */}
        <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
          <label className="block text-sm font-medium text-zinc-700 mb-1">Seed database</label>
          <p className="text-xs text-zinc-500 mb-2">
            Sends the prompt through pp-sketch: one request per generation (LLM call → validation →
            passage-judge gate (10 valid runs, ≤14 calls) → zero-context solvability filter (144
            valid runs, ≤300 calls) → one passage with one question + options/explanations/flow,
            all text converted to audio). Expect ~2–3 min per question. Gate-failed content is kept
            soft-deleted under Filter failures below. Only OpenAI, Anthropic, Gemini, Mistral and
            Sarvam models are wired.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={seedModelId}
              onChange={(e) => setSeedModelId(e.target.value)}
              className="rounded border border-zinc-300 p-2 text-sm text-zinc-900 bg-white"
            >
              <option value="">Model for seeding…</option>
              {seedableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.provider} · {m.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              Requests
              <input
                type="number"
                min={1}
                max={SEED_MAX_COUNT}
                value={count}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setCount(Number.isNaN(n) ? 1 : Math.min(Math.max(n, 1), SEED_MAX_COUNT));
                }}
                className="w-24 rounded border border-zinc-300 p-2 text-sm text-zinc-900"
              />
            </label>
            <button
              onClick={seed}
              disabled={seeding || !seedModelId}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              {seeding
                ? `Seeding… (${seedStates.filter((s) => s.status !== "running").length}/${seedStates.length})`
                : "Seed Database"}
            </button>
          </div>

          {seedStates.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-zinc-500">
                {seedStates.filter((s) => s.status === "created").length} created ·{" "}
                {seedStates.filter((s) => s.status === "rejected").length} rejected ·{" "}
                {seedStates.filter((s) => s.status === "failed").length} failed ·{" "}
                {seedStates.filter((s) => s.status === "running").length} running
              </p>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {seedStates.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-zinc-400 tabular-nums w-8 shrink-0">#{i + 1}</span>
                    {s.status === "running" && <span className="text-zinc-400">running…</span>}
                    {s.status === "created" && (
                      <span className="text-emerald-700">
                        created — level {s.level}
                        {s.ttsError && (
                          <span className="text-amber-600"> — TTS: {s.ttsError}</span>
                        )}
                      </span>
                    )}
                    {(s.status === "rejected" || s.status === "failed") && (
                      <span className={s.status === "failed" ? "text-red-600" : "text-amber-700"}>
                        {s.status}
                        {s.questionStatus === "discarded" && " (kept for troubleshooting)"} —{" "}
                        {s.reason}
                        {s.retriable && (
                          <button
                            onClick={() => retrySeed(i)}
                            className="ml-2 text-blue-600 underline"
                          >
                            retry
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={start}
          disabled={running || selected.size === 0}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {running ? "Running…" : `Test ${selected.size || ""} Model${selected.size === 1 ? "" : "s"}`}
        </button>

        {/* Summary — judge model verdict */}
        {summary.status !== "idle" && (
          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-zinc-900">Summary — {JUDGE_MODEL_NAME}</h3>
              {summary.status === "done" && !summary.data.error && <Metrics data={summary.data} />}
            </div>
            {summary.status === "loading" && (
              <p className="text-sm text-zinc-500">Judging responses…</p>
            )}
            {summary.status === "unavailable" && (
              <p className="text-sm text-zinc-500">
                Set {judgeModel?.envKey ?? "the judge model's API key"} in Railway to enable the{" "}
                {JUDGE_MODEL_NAME} summary.
              </p>
            )}
            {summary.status === "done" &&
              (summary.data.error ? (
                <p className="text-sm text-red-600 whitespace-pre-wrap">{summary.data.error}</p>
              ) : (
                <p className="text-sm text-zinc-800 whitespace-pre-wrap">{summary.data.text}</p>
              ))}
          </div>
        )}

        {/* Comparison graphs */}
        {(chartData.latency.length > 0 || chartData.cost.length > 0) && (
          <div className="mt-8 grid grid-cols-1 gap-4">
            <BarChart
              title="Latency (total round-trip)"
              unit="ms"
              color="#3b82f6"
              bars={chartData.latency}
              format={fmtLatency}
            />
            <BarChart
              title="Cost per call"
              unit="USD"
              color="#10b981"
              bars={chartData.cost}
              format={fmtCost}
            />
          </div>
        )}

        {/* Results */}
        {orderedResults.length > 0 && (
          <div className="mt-8 space-y-4">
            {orderedResults.map((id) => {
              const m = modelById.get(id)!;
              const state = results[id];
              return (
                <div
                  key={id}
                  id={`result-${id}`}
                  className="scroll-mt-4 rounded border border-zinc-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-zinc-900">
                      {m.label}{" "}
                      <span className="text-xs font-normal text-zinc-400">{m.provider}</span>
                    </div>
                    {state.status === "loading" ? (
                      <span className="text-xs text-zinc-400">running…</span>
                    ) : (
                      <Metrics data={state.data} />
                    )}
                  </div>
                  {state.status === "done" &&
                    (state.data.error ? (
                      <div className="text-sm text-red-600 whitespace-pre-wrap">{state.data.error}</div>
                    ) : (
                      <div className="text-sm text-zinc-800 whitespace-pre-wrap">{state.data.text}</div>
                    ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Recent gate-failed generations — read-only troubleshooting list */}
        <GenerationFailures />
      </div>
    </div>
  );
}

function fmtLatency(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function fmtCost(usd: number): string {
  if (usd === 0) return "$0";
  return usd < 0.001 ? `$${usd.toFixed(5)}` : `$${usd.toFixed(3)}`;
}

// ~4 "nice" y-axis ticks spanning [0, max].
function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const rawStep = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = ([1, 2, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? rawStep);
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.5; v += step) ticks.push(v);
  return ticks;
}

// Vertical SVG bar chart, one bar per model. Matches the dashboard's hand-rolled
// SVG chart style. Scrolls horizontally when there are many bars.
function BarChart({
  title,
  unit,
  color,
  bars,
  format,
}: {
  title: string;
  unit: string;
  color: string;
  bars: { id: string; label: string; value: number }[];
  format: (n: number) => string;
}) {
  // Fixed logical viewBox width; the SVG renders at w-full and scales to the
  // column, so every bar fits without a horizontal scrollbar and the height
  // stays constant regardless of bar count. Bars just get thinner as count grows.
  const VBW = 1000;
  const padL = 52;
  const padR = 16;
  const padT = 14;
  const plotH = 150;
  const padB = 78; // room for angled labels
  const H = padT + plotH + padB;

  if (bars.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-sm font-medium text-zinc-500 mb-2">{title}</h3>
        <p className="text-xs text-zinc-400">No data yet.</p>
      </div>
    );
  }

  const dataMax = Math.max(...bars.map((b) => b.value));
  const ticks = niceTicks(dataMax);
  const yHigh = Math.max(dataMax, ticks[ticks.length - 1]) || 1;
  const slot = (VBW - padL - padR) / bars.length;
  const barW = Math.min(40, slot * 0.62);
  const y = (v: number) => padT + plotH - (v / yHigh) * plotH;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-medium text-zinc-500 mb-2">{title}</h3>
      <svg viewBox={`0 0 ${VBW} ${H}`} className="w-full h-auto">
        {/* gridlines + y ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={y(t)} x2={VBW - padR} y2={y(t)} stroke="#e4e4e7" strokeWidth={0.5} />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize={9} className="fill-zinc-400">
              {format(t)}
            </text>
          </g>
        ))}
        {/* y-axis title */}
        <text
          x={12}
          y={padT + plotH / 2}
          textAnchor="middle"
          fontSize={9}
          className="fill-zinc-500"
          transform={`rotate(-90 12 ${padT + plotH / 2})`}
        >
          {unit}
        </text>
        {/* bars */}
        {bars.map((b, i) => {
          const cx = padL + slot * (i + 0.5);
          const top = y(b.value);
          return (
            <g key={`${b.label}-${i}`}>
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={Math.max(1, padT + plotH - top)}
                rx={2}
                fill={color}
              >
                <title>
                  {b.label}: {format(b.value)}
                </title>
              </rect>
              <text x={cx} y={top - 4} textAnchor="middle" fontSize={8} className="fill-zinc-500">
                {format(b.value)}
              </text>
              <text
                x={cx}
                y={padT + plotH + 10}
                textAnchor="end"
                fontSize={8}
                className="cursor-pointer fill-blue-600 underline"
                transform={`rotate(-40 ${cx} ${padT + plotH + 10})`}
                onClick={() =>
                  document
                    .getElementById(`result-${b.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                <title>Jump to {b.label} response</title>
                {b.label}
              </text>
            </g>
          );
        })}
        {/* baseline */}
        <line x1={padL} y1={padT + plotH} x2={VBW - padR} y2={padT + plotH} stroke="#a1a1aa" strokeWidth={1} />
      </svg>
    </div>
  );
}

function Metrics({ data }: { data: CallResult }) {
  if (data.error) return null;
  const tps =
    data.completionTokens && data.ttftMs !== null && data.totalMs > data.ttftMs
      ? (data.completionTokens / ((data.totalMs - data.ttftMs) / 1000)).toFixed(0)
      : null;
  return (
    <div className="flex gap-3 text-xs text-zinc-500 tabular-nums">
      <span title="Time to first token">TTFT {data.ttftMs !== null ? `${data.ttftMs.toFixed(0)}ms` : "—"}</span>
      <span title="Total round-trip">total {data.totalMs.toFixed(0)}ms</span>
      {tps && <span title="Output tokens/sec">{tps} tok/s</span>}
      <span title="Prompt / completion tokens">
        {data.promptTokens ?? "—"}/{data.completionTokens ?? "—"} tok
      </span>
      <span title="Estimated cost" className="text-zinc-700">
        {data.costUsd !== null ? `$${data.costUsd.toFixed(5)}` : "—"}
      </span>
    </div>
  );
}

function emptyResult(): CallResult {
  return {
    text: "",
    ttftMs: null,
    totalMs: 0,
    promptTokens: null,
    completionTokens: null,
    costUsd: null,
  };
}
