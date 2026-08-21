"use client";

import { useCallback, useEffect, useState } from "react";
import { CoverageModal } from "./coverage-modal";
import { TypeBadges } from "./type-badges";
import {
  PASSAGE_TYPES,
  QUESTION_TYPE_CODES,
  type PassageSearchResponse,
} from "./types";

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

// Passage finder: substring search over the passage text plus
// narrative/expository and R-code filters. A row opens the read-only
// comprehension modal (passage + flow question); the roll-back action
// soft-deletes the WHOLE passage family server-side (same endpoint as the
// comprehension table: DELETE by-state-transition-id on the flow stid).
export function PassageSearch() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [passageType, setPassageType] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<PassageSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openStid, setOpenStid] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(nextOffset),
        });
        if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
        if (passageType) params.set("passage_type", passageType);
        if (questionType) params.set("question_type", questionType);
        const res = await fetch(
          `/api/proxy/media-meta-data/passages?${params.toString()}`,
        );
        if (!res.ok) {
          setError(`Failed to load (${res.status})`);
          return;
        }
        setData((await res.json()) as PassageSearchResponse);
        setOffset(nextOffset);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [debouncedQ, passageType, questionType],
  );

  // New search input or filter resets to the first page.
  useEffect(() => {
    void load(0);
  }, [load]);

  async function deletePassage(id: string) {
    setDeleting(id);
    setError(null);
    try {
      const stid = `${id}-sentence-comprehension`;
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
      setConfirmId(null);
    }
  }

  const total = data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-sm font-semibold text-zinc-900">Find a passage</h2>
        <span className="text-xs text-zinc-400">
          {total} match{total === 1 ? "" : "es"} · roll back removes the whole
          passage family from lessons (soft delete)
        </span>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search passage text…"
          className="w-72 rounded border border-zinc-300 p-2 text-sm text-zinc-900 bg-white"
        />
        <select
          value={passageType}
          onChange={(e) => setPassageType(e.target.value)}
          className="rounded border border-zinc-300 p-2 text-sm text-zinc-900 bg-white"
        >
          <option value="">any type</option>
          {PASSAGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={questionType}
          onChange={(e) => setQuestionType(e.target.value)}
          className="rounded border border-zinc-300 p-2 text-sm text-zinc-900 bg-white"
        >
          <option value="">any R-code</option>
          {QUESTION_TYPE_CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {loading && <span className="text-xs text-zinc-400">Searching…</span>}
      </div>
      {error && <div className="mb-2 text-sm text-red-600">{error}</div>}
      {data && data.rows.length === 0 && !loading && (
        <div className="text-sm text-zinc-400">No matching passages.</div>
      )}
      {data && data.rows.length > 0 && (
        <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="px-3 py-2 font-medium">passage</th>
                <th className="px-3 py-2 font-medium">type</th>
                <th className="px-3 py-2 font-medium">model</th>
                <th className="px-3 py-2 font-medium">created</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setOpenStid(`${row.id}-sentence-comprehension`)}
                  className="border-b border-zinc-100 last:border-0 hover:bg-emerald-50 cursor-pointer"
                  title={row.id}
                >
                  <td className="max-w-md truncate px-3 py-1.5 text-zinc-800">
                    {row.preview}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <TypeBadges
                      level={row.level}
                      passageType={row.passage_type}
                      questionType={row.question_type}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-zinc-500">
                    {row.model ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-zinc-500">
                    {new Date(row.created_at).toLocaleDateString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </td>
                  {/* Delete flow must not also open the view modal. */}
                  <td
                    className="px-3 py-1.5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {confirmId === row.id ? (
                      <span className="inline-flex gap-2">
                        <button
                          onClick={() => void deletePassage(row.id)}
                          disabled={deleting !== null}
                          className="text-red-600 hover:underline disabled:opacity-40"
                        >
                          {deleting === row.id ? "rolling back…" : "confirm roll back"}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-zinc-500 hover:underline"
                        >
                          cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmId(row.id)}
                        className="text-zinc-400 hover:text-red-600"
                      >
                        roll back
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {openStid && (
        <CoverageModal
          stid={openStid}
          readOnly
          onClose={() => setOpenStid(null)}
        />
      )}
      {total > PAGE_SIZE && (
        <div className="mt-2 flex items-center gap-3 text-xs text-zinc-600">
          <button
            onClick={() => void load(Math.max(0, offset - PAGE_SIZE))}
            disabled={loading || offset === 0}
            className="text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline"
          >
            ← Prev
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            onClick={() => void load(offset + PAGE_SIZE)}
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
