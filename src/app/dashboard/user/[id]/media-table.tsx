"use client";

import { useState, useCallback, useEffect } from "react";

interface Transcript {
  text: string | null;
  source: string;
}

interface MediaRow {
  id: string;
  created_at: string;
  has_audio: boolean;
  transcripts: Transcript[];
}

export function MediaTable({ userId }: { userId: string }) {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proxy/users/${userId}/media?offset=${rows.length}`
      );
      if (!res.ok) return;
      const data: MediaRow[] = await res.json();
      setRows((prev) => [...prev, ...data]);
      if (data.length < 100) setHasMore(false);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [userId, rows.length]);

  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500 text-xs uppercase tracking-wide">
            <th className="py-3 px-4 font-medium">#</th>
            <th className="py-3 px-4 font-medium">Timestamp</th>
            <th className="py-3 px-4 font-medium">Audio</th>
            <th className="py-3 px-4 font-medium">Transcript</th>
            <th className="py-3 px-4 font-medium">Correct Answer</th>
            <th className="py-3 px-4 font-medium">Answer Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id}
              className="border-b border-zinc-100 hover:bg-zinc-50 align-top"
            >
              <td className="py-2.5 px-4 text-zinc-400">{i + 1}</td>
              <td className="py-2.5 px-4 text-zinc-600 whitespace-nowrap">
                {new Date(row.created_at).toLocaleString()}
              </td>
              <td className="py-2.5 px-4">
                {row.has_audio ? (
                  <audio
                    controls
                    preload="none"
                    className="h-8 w-48"
                    src={`/api/proxy/media-meta-data/${row.id}/audio`}
                  />
                ) : (
                  <span className="text-zinc-400 italic text-xs">
                    No audio
                  </span>
                )}
              </td>
              <td className="py-2.5 px-4">
                {row.transcripts.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {row.transcripts.map((t, j) => (
                      <div key={j} className="text-sm">
                        <span className="text-xs font-medium text-zinc-400 mr-1">
                          {t.source}:
                        </span>
                        <span className="text-zinc-700">
                          {t.text || <em className="text-zinc-400">empty</em>}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-zinc-400 italic text-xs">
                    No transcripts
                  </span>
                )}
              </td>
              <td className="py-2.5 px-4 text-zinc-400 italic">--</td>
              <td className="py-2.5 px-4 text-zinc-400 italic">--</td>
            </tr>
          ))}
          {loading && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-zinc-400">
                Loading...
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {hasMore && loaded && (
        <div className="flex justify-center py-4">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md transition-colors disabled:opacity-40"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
      {!hasMore && loaded && rows.length > 0 && (
        <p className="text-center py-4 text-xs text-zinc-400">
          All media loaded
        </p>
      )}
      {!loading && loaded && rows.length === 0 && (
        <p className="text-center py-8 text-zinc-400">
          No WhatsApp media found for this user
        </p>
      )}
    </div>
  );
}
