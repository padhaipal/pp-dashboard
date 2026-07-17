"use client";

import { useMemo, useState } from "react";
import type { CallResult, ChatMessage } from "./models";

export type ClientModel = {
  id: string;
  label: string;
  provider: string;
  envKey: string;
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

function formatSentPrompt(messages: ChatMessage[]): string {
  return messages.map((m) => `[${m.role}]\n${m.content}`).join("\n\n");
}

function formatResponses(items: { label: string; data: CallResult }[]): string {
  return items
    .map(({ label, data }) => {
      const ttft = data.ttftMs !== null ? `TTFT ${Math.round(data.ttftMs)}ms, ` : "";
      const cost = data.costUsd !== null ? `, cost $${data.costUsd.toFixed(5)}` : "";
      return `### ${label} (${ttft}total ${Math.round(data.totalMs)}ms${cost})\n${data.text}`;
    })
    .join("\n\n");
}

function fillJudgePrompt(template: string, promptText: string, responsesText: string): string {
  return template
    .replaceAll("<LLM prompt>", promptText)
    .replaceAll("<LLM responses>", responsesText);
}

export function LlmConsole({ models }: { models: ClientModel[] }) {
  const [system, setSystem] = useState("");
  const [rows, setRows] = useState<Row[]>([{ role: "user", content: "" }]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, ResultState>>({});
  const [running, setRunning] = useState(false);
  const [language, setLanguage] = useState<"english" | "hindi">("english");
  const [judgePrompt, setJudgePrompt] = useState(DEFAULT_JUDGE_PROMPT);
  const [summary, setSummary] = useState<SummaryState>({ status: "idle" });

  const judgeModel = useMemo(() => models.find((m) => m.id === JUDGE_MODEL_ID), [models]);

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

  function buildMessages(): ChatMessage[] {
    const msgs: ChatMessage[] = [];
    if (language === "hindi") msgs.push({ role: "system", content: HINDI_DIRECTIVE });
    if (system.trim()) msgs.push({ role: "system", content: system });
    for (const r of rows) if (r.content.trim()) msgs.push({ role: r.role, content: r.content });
    return msgs;
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

        <button
          onClick={start}
          disabled={running || selected.size === 0}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {running ? "Running…" : `Test ${selected.size || ""} model${selected.size === 1 ? "" : "s"}`}
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
