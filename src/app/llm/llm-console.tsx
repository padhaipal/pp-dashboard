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

  function buildMessages(): ChatMessage[] {
    const msgs: ChatMessage[] = [];
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

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-semibold text-zinc-900 mb-1">LLM Playground</h1>
        <p className="text-sm text-zinc-500 mb-6">
          Compare quality, latency (TTFT + total) and cost across models. Greyed models need their
          API key set in Railway.
        </p>

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
          <label className="block text-sm font-medium text-zinc-700 mb-2">Models to test</label>
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
