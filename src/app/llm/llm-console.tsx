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

export function LlmConsole({ models }: { models: ClientModel[] }) {
  const [system, setSystem] = useState("");
  const [rows, setRows] = useState<Row[]>([{ role: "user", content: "" }]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, ResultState>>({});
  const [running, setRunning] = useState(false);
  const [language, setLanguage] = useState<"english" | "hindi">("english");

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
    setResults(Object.fromEntries(ids.map((id) => [id, { status: "loading" }])));

    // Fire all in parallel; each card updates the moment its model responds.
    await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch("/api/llm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modelId: id, messages }),
          });
          const data: CallResult = res.ok
            ? await res.json()
            : { ...emptyResult(), error: (await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}` };
          setResults((prev) => ({ ...prev, [id]: { status: "done", data } }));
        } catch (err) {
          setResults((prev) => ({
            ...prev,
            [id]: { status: "done", data: { ...emptyResult(), error: (err as Error).message } },
          }));
        }
      }),
    );
    setRunning(false);
  }

  const modelById = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);
  const orderedResults = [...selected].filter((id) => results[id]);

  // Bars for the latency + cost graphs: only completed, error-free numeric
  // results. Sorted ascending (fastest / cheapest first).
  const chartData = useMemo(() => {
    const latency: { label: string; value: number }[] = [];
    const cost: { label: string; value: number }[] = [];
    for (const id of [...selected]) {
      const st = results[id];
      const m = modelById.get(id);
      if (!m || st?.status !== "done" || st.data.error) continue;
      const label = `${m.provider} · ${m.label}`;
      if (st.data.totalMs > 0) latency.push({ label, value: st.data.totalMs });
      if (st.data.costUsd !== null) cost.push({ label, value: st.data.costUsd });
    }
    latency.sort((a, b) => a.value - b.value);
    cost.sort((a, b) => a.value - b.value);
    return { latency, cost };
  }, [selected, results, modelById]);

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
          className="w-full mb-4 rounded border border-zinc-300 p-2 text-sm text-zinc-900"
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
                className="flex-1 rounded border border-zinc-300 p-2 text-sm text-zinc-900"
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

        <button
          onClick={start}
          disabled={running || selected.size === 0}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {running ? "Running…" : `Test ${selected.size || ""} model${selected.size === 1 ? "" : "s"}`}
        </button>

        {/* Comparison graphs */}
        {(chartData.latency.length > 0 || chartData.cost.length > 0) && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div key={id} className="rounded border border-zinc-200 bg-white p-4">
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
  bars: { label: string; value: number }[];
  format: (n: number) => string;
}) {
  const barW = 30;
  const gap = 16;
  const padL = 52;
  const padR = 12;
  const padT = 14;
  const plotH = 150;
  const padB = 72; // room for angled labels

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
  const W = padL + padR + bars.length * (barW + gap);
  const H = padT + plotH + padB;
  const y = (v: number) => padT + plotH - (v / yHigh) * plotH;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-medium text-zinc-500 mb-2">{title}</h3>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="max-w-none">
          {/* gridlines + y ticks */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke="#e4e4e7" strokeWidth={0.5} />
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
            const x = padL + i * (barW + gap) + gap / 2;
            const top = y(b.value);
            const cx = x + barW / 2;
            return (
              <g key={`${b.label}-${i}`}>
                <rect x={x} y={top} width={barW} height={Math.max(1, padT + plotH - top)} rx={2} fill={color}>
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
                  className="fill-zinc-600"
                  transform={`rotate(-40 ${cx} ${padT + plotH + 10})`}
                >
                  {b.label}
                </text>
              </g>
            );
          })}
          {/* baseline */}
          <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="#a1a1aa" strokeWidth={1} />
        </svg>
      </div>
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
