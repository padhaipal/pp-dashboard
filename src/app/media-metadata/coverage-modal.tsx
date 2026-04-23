"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

interface MediaItem {
  id: string;
  media_type: "audio" | "text" | "video" | "image" | "sticker";
  source: string;
  status: string;
  created_at: string;
  state_transition_id: string | null;
  text: string | null;
  has_content: boolean;
  content_mime: string | null;
  generation_script: string | null;
  wa_media_url: string | null;
}

function formatIST(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function AudioPlayer({ mediaId }: { mediaId: string }) {
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

function MediaPreview({ item }: { item: MediaItem }) {
  if (item.media_type === "audio" && item.has_content) {
    return <AudioPlayer mediaId={item.id} />;
  }
  if (item.media_type === "video" && item.has_content) {
    return (
      <video
        controls
        preload="metadata"
        className="max-w-md max-h-64 rounded border border-zinc-200"
        src={`/api/proxy/media-meta-data/${item.id}/audio`}
      />
    );
  }
  if (
    (item.media_type === "image" || item.media_type === "sticker") &&
    item.has_content
  ) {
    return (
      <div className="relative w-80 h-48 rounded border border-zinc-200 bg-zinc-50 overflow-hidden">
        <Image
          alt={`${item.media_type} preview`}
          src={`/api/proxy/media-meta-data/${item.id}/audio`}
          fill
          unoptimized
          className="object-contain"
        />
      </div>
    );
  }
  if (item.media_type === "text" && item.text) {
    return (
      <div className="text-sm text-zinc-800 bg-zinc-50 border border-zinc-200 rounded px-3 py-2 whitespace-pre-wrap">
        {item.text}
      </div>
    );
  }
  return <div className="text-xs text-zinc-400 italic">No content</div>;
}

function MediaCard({
  item,
  onDelete,
}: {
  item: MediaItem;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/media-meta-data/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(`Delete failed (${res.status})`);
        return;
      }
      onDelete(item.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="border border-zinc-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium uppercase tracking-wide bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">
            {item.media_type}
          </span>
          <span className="text-xs text-zinc-500">{item.source}</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              item.status === "ready"
                ? "bg-emerald-50 text-emerald-700"
                : item.status === "failed"
                  ? "bg-red-50 text-red-700"
                  : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {item.status}
          </span>
          <span className="text-xs text-zinc-400">
            {formatIST(item.created_at)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={deleting}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
            >
              Delete
            </button>
          ) : (
            <>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-0.5 rounded disabled:opacity-40"
              >
                {deleting ? "..." : "Confirm"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="text-xs text-zinc-400 hover:text-zinc-600"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-3">
        <MediaPreview item={item} />
      </div>

      {item.generation_script && (
        <div className="text-xs mb-2">
          <span className="font-medium text-zinc-500 mr-1">script:</span>
          <span className="text-zinc-700">{item.generation_script}</span>
        </div>
      )}
      {item.wa_media_url && (
        <div className="text-xs text-zinc-500 truncate">
          <span className="font-medium mr-1">wa_media_url:</span>
          <span className="font-mono">{item.wa_media_url}</span>
        </div>
      )}
      <div className="text-[10px] font-mono text-zinc-300 mt-1">{item.id}</div>
      {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
    </div>
  );
}

export function CoverageModal({
  stid,
  onClose,
}: {
  stid: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proxy/media-meta-data/by-state-transition-id?state_transition_id=${encodeURIComponent(stid)}`,
      );
      if (!res.ok) {
        setError(`Failed to load (${res.status})`);
        return;
      }
      setItems(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [stid]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleDeleted = (id: string) => {
    setItems((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-zinc-50 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 py-3 border-b border-zinc-200">
          <h2 className="text-sm font-mono text-zinc-800 text-center truncate pr-6">
            {stid}
          </h2>
          <button
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5 overflow-auto flex-1">
          {loading && !items && (
            <div className="text-sm text-zinc-400">Loading...</div>
          )}
          {error && <div className="text-sm text-red-600">{error}</div>}
          {items && items.length === 0 && (
            <div className="text-sm text-zinc-400 italic">
              No media for this state transition id.
            </div>
          )}
          {items && items.length > 0 && (
            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onDelete={handleDeleted}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}