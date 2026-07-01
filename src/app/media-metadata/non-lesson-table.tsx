"use client";

import { useCallback, useEffect, useState } from "react";
import { CoverageModal } from "./coverage-modal";
import { MediaCounts } from "./media-counts";
import {
  ALL_MEDIA_TYPES,
  NON_LESSON_STIDS,
  type MediaType,
  type MediaTypeCounts,
} from "./types";

// Minimal shape of a /by-state-transition-id row — we only need the media_type
// to tally counts. (Same endpoint the modal loads, so counts stay consistent.)
interface StidMediaRow {
  media_type: MediaType;
}

type RowState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; counts: MediaTypeCounts };

function emptyCounts(): MediaTypeCounts {
  return { audio: 0, text: 0, video: 0, image: 0, sticker: 0 };
}

async function fetchCounts(stid: string): Promise<MediaTypeCounts> {
  const res = await fetch(
    `/api/proxy/media-meta-data/by-state-transition-id?state_transition_id=${encodeURIComponent(stid)}`,
  );
  if (!res.ok) throw new Error(`load failed (${res.status})`);
  const rows = (await res.json()) as StidMediaRow[];
  const counts = emptyCounts();
  for (const row of rows) {
    if (row.media_type in counts) counts[row.media_type] += 1;
  }
  return counts;
}

// This table covers the non-lesson state_transition_ids, which the /coverage grid
// omits. Column 1 is a HARDCODED list (see NON_LESSON_STIDS in types.ts); column 2
// shows live media counts fetched per-STID. The hardcoded list is a stopgap — the
// real fix is a `state_transitions` table in the database that both pp-sketch and
// this dashboard read from.
export function NonLessonTable() {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(true);
  const [openStid, setOpenStid] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        NON_LESSON_STIDS.map((s) => fetchCounts(s)),
      );
      const next: Record<string, RowState> = {};
      NON_LESSON_STIDS.forEach((stid, i) => {
        const r = results[i];
        next[stid] =
          r.status === "fulfilled"
            ? { status: "ready", counts: r.value }
            : { status: "error" };
      });
      setRows(next);
    } catch {
      // allSettled shouldn't reject, but never leave rows stuck on "Loading…".
      setRows(
        Object.fromEntries(
          NON_LESSON_STIDS.map((s) => [s, { status: "error" } as RowState]),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-zinc-700 mb-2 flex items-center gap-2">
        Non-lesson state transitions
        {loading && (
          <span className="text-xs font-normal text-zinc-400">refreshing…</span>
        )}
      </h2>
      <div className="overflow-hidden border border-zinc-200 rounded-md bg-white">
        <table className="text-xs w-full">
          <thead className="bg-zinc-100">
            <tr>
              <th className="py-2 px-3 text-left font-medium text-zinc-700 border-r border-zinc-200">
                state_transition_id
              </th>
              <th className="py-2 px-3 text-left font-medium text-zinc-700">
                media
              </th>
            </tr>
          </thead>
          <tbody>
            {NON_LESSON_STIDS.map((stid) => {
              const row = rows[stid] ?? { status: "loading" };
              return (
                <tr
                  key={stid}
                  onClick={() => setOpenStid(stid)}
                  className="border-t border-zinc-100 hover:bg-emerald-50 cursor-pointer"
                  title={stid}
                >
                  <td className="py-1.5 px-3 font-mono text-zinc-800 border-r border-zinc-100">
                    {stid}
                  </td>
                  <td className="py-1.5 px-3">
                    {row.status === "loading" && (
                      <span className="text-zinc-400">Loading…</span>
                    )}
                    {row.status === "error" && (
                      <span className="text-red-500" title="Failed to load counts">
                        ! failed to load
                      </span>
                    )}
                    {row.status === "ready" && (
                      <MediaCounts
                        counts={row.counts}
                        mediaTypes={ALL_MEDIA_TYPES}
                        emptyContent={
                          <span className="text-zinc-300">—</span>
                        }
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {openStid && (
        <CoverageModal
          stid={openStid}
          onClose={() => {
            setOpenStid(null);
            // Refresh counts — media may have been added/deleted in the modal.
            load();
          }}
        />
      )}
    </div>
  );
}
