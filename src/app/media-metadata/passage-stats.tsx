"use client";

import { useCallback, useEffect, useState } from "react";
import type { PassageStatsResponse } from "./types";

// Live inventory of active (ready, non-deleted) reading passages, grouped by
// level with a narrative/expository split and per-R-code counts. Mounted on
// /media-metadata and inside /llm's Seed database section so the operator
// can see which cells need seeding before firing a batch.
export function PassageStats() {
  const [data, setData] = useState<PassageStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/media-meta-data/passage-stats");
      if (!res.ok) {
        setError(`Failed to load (${res.status})`);
        return;
      }
      setData((await res.json()) as PassageStatsResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = data?.rows.reduce((sum, r) => sum + r.passages, 0) ?? 0;
  // level → passage_type → "R1.1 ×2, …" cells.
  const levels = Array.from(
    new Set((data?.rows ?? []).map((r) => r.level ?? 0)),
  ).sort((a, b) => a - b);
  const cell = (level: number, passageType: string) => {
    const rows = (data?.rows ?? []).filter(
      (r) => (r.level ?? 0) === level && r.passage_type === passageType,
    );
    if (rows.length === 0) {
      return <span className="text-zinc-300">—</span>;
    }
    return (
      <span className="inline-flex flex-wrap gap-1">
        {rows.map((r) => (
          <span
            key={`${r.question_type ?? "?"}`}
            className="rounded bg-zinc-100 px-1 font-mono text-[10px] text-zinc-600"
          >
            {r.question_type ?? "?"}&thinsp;×{r.passages}
          </span>
        ))}
      </span>
    );
  };

  return (
    <div className="mb-4 rounded border border-zinc-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">
          Active reading passages
        </h3>
        <span className="text-xs text-zinc-400">{total} live</span>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="ml-auto text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-40"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
      {data && data.rows.length === 0 && !error && (
        <div className="text-xs text-zinc-400">
          No live passages — seed some on the /llm page.
        </div>
      )}
      {data && data.rows.length > 0 && (
        <table className="text-xs">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-1 pr-4 font-medium">level</th>
              <th className="py-1 pr-6 font-medium">narrative</th>
              <th className="py-1 font-medium">expository</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((level) => (
              <tr key={level} className="border-t border-zinc-100 align-top">
                <td className="py-1 pr-4 font-mono text-zinc-800">
                  {level || "?"}
                </td>
                <td className="py-1 pr-6">{cell(level, "narrative")}</td>
                <td className="py-1">{cell(level, "expository")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
