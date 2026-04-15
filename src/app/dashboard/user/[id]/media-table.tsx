"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface Transcript {
  text: string | null;
  source: string;
}

interface MediaRow {
  id: string;
  created_at: string;
  has_audio: boolean;
  transcripts: Transcript[];
  word: string | null;
}

interface UserInfo {
  name: string | null;
  phone: string;
}

function formatIST(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function DashboardTranscript({
  mediaId,
  existing,
  onUpdate,
}: {
  mediaId: string;
  existing: Transcript | null;
  onUpdate: (t: Transcript | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(existing?.text ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const method = existing ? "PATCH" : "POST";
      const res = await fetch(
        `/api/proxy/media-meta-data/${mediaId}/dashboard-transcript`,
        {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        }
      );
      if (!res.ok) return;
      onUpdate({ text: text.trim(), source: "dashboard" });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/proxy/media-meta-data/${mediaId}/dashboard-transcript`,
        { method: "DELETE" }
      );
      if (!res.ok) return;
      onUpdate(null);
      setText("");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* "+ add" button in top-right of cell */}
      {!existing && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="absolute top-2 right-3 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          + add
        </button>
      )}

      {/* Existing dashboard transcript display */}
      {existing && !editing && (
        <div className="text-sm flex items-start gap-1 group">
          <span className="text-xs font-medium text-zinc-400 mr-1">dashboard:</span>
          <span className="text-zinc-700">{existing.text}</span>
          <button
            onClick={() => {
              setText(existing.text ?? "");
              setEditing(true);
            }}
            className="text-xs text-zinc-300 hover:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
          >
            edit
          </button>
        </div>
      )}

      {/* Editing form */}
      {editing && (
        <div className="flex items-center gap-1 mt-1">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="border border-zinc-300 rounded px-1.5 py-0.5 text-sm w-40 focus:outline-none focus:border-zinc-500"
            autoFocus
            disabled={saving}
          />
          <button
            onClick={save}
            disabled={saving || !text.trim()}
            className="text-xs text-emerald-600 hover:text-emerald-700 disabled:opacity-40"
          >
            save
          </button>
          {existing && (
            <button
              onClick={remove}
              disabled={saving}
              className="text-xs text-red-500 hover:text-red-600 disabled:opacity-40"
            >
              del
            </button>
          )}
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            className="text-xs text-zinc-400 hover:text-zinc-500"
          >
            cancel
          </button>
        </div>
      )}
    </>
  );
}

function AudioCell({ mediaId }: { mediaId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState<number | null>(null);

  return (
    <div className="flex items-center gap-2">
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        className="h-8 w-64"
        src={`/api/proxy/media-meta-data/${mediaId}/audio`}
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration;
          if (d && isFinite(d)) setDuration(d);
        }}
      />
      {duration !== null && (
        <span className="text-xs text-zinc-400 whitespace-nowrap">
          {duration.toFixed(1)}s
        </span>
      )}
    </div>
  );
}

export function MediaTable({
  userId,
  onUserLoaded,
}: {
  userId: string;
  onUserLoaded: (user: UserInfo) => void;
}) {
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
      const data = await res.json();
      const media: MediaRow[] = data.media;
      if (data.user) onUserLoaded(data.user);
      setRows((prev) => [...prev, ...media]);
      if (media.length < 100) setHasMore(false);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [userId, rows.length, onUserLoaded]);

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
                {formatIST(row.created_at)}
              </td>
              <td className="py-2.5 px-4">
                {row.has_audio ? (
                  <AudioCell mediaId={row.id} />
                ) : (
                  <span className="text-zinc-400 italic text-xs">
                    No audio
                  </span>
                )}
              </td>
              <td className="py-2.5 px-4 relative">
                <div className="flex flex-col gap-1">
                  {row.transcripts
                    .filter((t) => t.source !== "dashboard")
                    .map((t, j) => (
                      <div key={j} className="text-sm">
                        <span className="text-xs font-medium text-zinc-400 mr-1">
                          {t.source}:
                        </span>
                        <span className="text-zinc-700">
                          {t.text || <em className="text-zinc-400">empty</em>}
                        </span>
                      </div>
                    ))}
                  {row.transcripts.filter((t) => t.source !== "dashboard").length === 0 && (
                    <span className="text-zinc-400 italic text-xs">
                      No transcripts
                    </span>
                  )}
                  <DashboardTranscript
                    mediaId={row.id}
                    existing={row.transcripts.find((t) => t.source === "dashboard") ?? null}
                    onUpdate={(t) => {
                      setRows((prev) =>
                        prev.map((r) => {
                          if (r.id !== row.id) return r;
                          const others = r.transcripts.filter((x) => x.source !== "dashboard");
                          return { ...r, transcripts: t ? [...others, t] : others };
                        })
                      );
                    }}
                  />
                </div>
              </td>
              {/* word data available in row.word but stubbed for now */}
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
