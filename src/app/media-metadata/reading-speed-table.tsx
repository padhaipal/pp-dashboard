"use client";

import { useCallback, useEffect, useState } from "react";
import { CoverageModal } from "./coverage-modal";
import { MediaCounts } from "./media-counts";
import {
  ALL_MEDIA_TYPES,
  READING_SPEED_STIDS,
  type MediaType,
  type MediaTypeCounts,
} from "./types";

// One row of GET /media-meta-data/stid-counts — counts pre-grouped
// server-side so 203 stids cost a single request, not one per row.
interface StidCountRow {
  state_transition_id: string;
  media_type: MediaType;
  count: number;
}

function emptyCounts(): MediaTypeCounts {
  return { audio: 0, text: 0, video: 0, image: 0, sticker: 0, flow: 0 };
}

async function fetchAllCounts(): Promise<Record<string, MediaTypeCounts>> {
  const res = await fetch(
    `/api/proxy/media-meta-data/stid-counts?suffix=${encodeURIComponent("-wpm-reading-speed")}`,
  );
  if (!res.ok) throw new Error(`load failed (${res.status})`);
  const rows = (await res.json()) as StidCountRow[];
  const bySteid: Record<string, MediaTypeCounts> = {};
  for (const row of rows) {
    const counts = (bySteid[row.state_transition_id] ??= emptyCounts());
    if (row.media_type in counts) counts[row.media_type] += row.count;
  }
  return bySteid;
}

// All 203 reading-speed stids (generic `_`, 0, 1–200, 200plus) with live
// media counts. Stids absent from the response render as zero-count rows —
// unseeded is the normal state here, so the table scrolls inside a fixed
// height instead of dominating the page.
export function ReadingSpeedTable() {
  const [counts, setCounts] = useState<Record<string, MediaTypeCounts>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openStid, setOpenStid] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setCounts(await fetchAllCounts());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-zinc-700 mb-1 flex items-center gap-2">
        Reading speed
        {loading && (
          <span className="text-xs font-normal text-zinc-400">refreshing…</span>
        )}
      </h2>
      <p className="text-xs text-zinc-500 mb-2">
        Generic `_` row serves every integer; specific rows override it.
      </p>
      {error && (
        <div className="text-xs text-red-500 mb-2">! failed to load counts</div>
      )}
      <div className="overflow-hidden border border-zinc-200 rounded-md bg-white">
        <div className="max-h-80 overflow-y-auto">
          <table className="text-xs w-full">
            <thead className="bg-zinc-100 sticky top-0">
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
              {READING_SPEED_STIDS.map((stid) => (
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
                    <MediaCounts
                      counts={counts[stid] ?? emptyCounts()}
                      mediaTypes={ALL_MEDIA_TYPES}
                      emptyContent={<span className="text-zinc-300">—</span>}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
