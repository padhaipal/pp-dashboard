"use client";

import { useCallback, useEffect, useState } from "react";
import type { ComprehensionStidsResponse } from "./types";

const PAGE_SIZE = 50;

// Paginated table of the DYNAMIC comprehension state transition ids:
// `${passageId}-sentence-comprehension` (flow rows, one per question — the
// runtime `…-correct-first|retry` stids map onto them) and
// `${answerId}-comprehension-complete` (explanation text/audio rows). These
// are created by the /llm seeding page and will eventually number in the
// thousands, hence server-side pagination (unlike the hardcoded
// NON_LESSON_STIDS list). Delete-only by design: creation happens on /llm,
// and deleting a `…-sentence-comprehension` stid tears down the whole
// passage family server-side.
export function ComprehensionTable() {
  const [data, setData] = useState<ComprehensionStidsResponse | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStid, setConfirmStid] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proxy/media-meta-data/comprehension-stids?limit=${PAGE_SIZE}&offset=${nextOffset}`,
      );
      if (!res.ok) {
        setError(`Failed to load (${res.status})`);
        return;
      }
      setData((await res.json()) as ComprehensionStidsResponse);
      setOffset(nextOffset);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(0);
  }, [load]);

  async function deleteStid(stid: string) {
    setDeleting(stid);
    setError(null);
    try {
      const res = await fetch(
        `/api/proxy/media-meta-data/by-state-transition-id?state_transition_id=${encodeURIComponent(stid)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        setError(`Delete failed (${res.status})`);
        return;
      }
      await load(offset);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(null);
      setConfirmStid(null);
    }
  }

  const total = data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-sm font-semibold text-zinc-900">
          Comprehension state transitions
        </h2>
        <span className="text-xs text-zinc-400">
          {total} stids · created on the /llm page · deleting a
          …-sentence-comprehension row removes the whole passage family
        </span>
      </div>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      {!data && loading && (
        <div className="text-sm text-zinc-400">Loading...</div>
      )}
      {data && data.rows.length === 0 && (
        <div className="text-sm text-zinc-400">
          No comprehension media yet — seed some on the /llm page.
        </div>
      )}
      {data && data.rows.length > 0 && (
        <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="px-3 py-2 font-medium">state_transition_id</th>
                <th className="px-3 py-2 font-medium">media</th>
                <th className="px-3 py-2 font-medium">created</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={row.state_transition_id}
                  className="border-b border-zinc-100 last:border-0"
                >
                  <td className="px-3 py-1.5 font-mono text-zinc-800">
                    {row.state_transition_id}
                  </td>
                  <td className="px-3 py-1.5 tabular-nums text-zinc-600">
                    {row.media_count}
                  </td>
                  <td className="px-3 py-1.5 text-zinc-500">
                    {new Date(row.created_at).toLocaleDateString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {confirmStid === row.state_transition_id ? (
                      <span className="inline-flex gap-2">
                        <button
                          onClick={() => deleteStid(row.state_transition_id)}
                          disabled={deleting !== null}
                          className="text-red-600 hover:underline disabled:opacity-40"
                        >
                          {deleting === row.state_transition_id
                            ? "deleting…"
                            : "confirm delete"}
                        </button>
                        <button
                          onClick={() => setConfirmStid(null)}
                          className="text-zinc-500 hover:underline"
                        >
                          cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmStid(row.state_transition_id)}
                        className="text-zinc-400 hover:text-red-600"
                      >
                        delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > PAGE_SIZE && (
        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600">
          <button
            onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
            disabled={loading || offset === 0}
            className="text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline"
          >
            ← Prev
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            onClick={() => load(offset + PAGE_SIZE)}
            disabled={loading || offset + PAGE_SIZE >= total}
            className="text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
