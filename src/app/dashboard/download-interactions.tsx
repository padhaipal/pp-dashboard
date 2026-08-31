"use client";

import { useState } from "react";

// Full student-interaction CSV export (dev-only; rendered only for the dev
// role, and the proxy's admin allowlist does not include the path). A plain
// anchor — NOT fetch + Blob — so the browser streams the response straight
// to disk with no memory ceiling. Blank dates = all time; the file ends with
// a "# export complete, N rows" marker, so a cut-off download is detectable
// and resumable by re-running with `from` = the last row's timestamp.
export function DownloadInteractions() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const qs = new URLSearchParams();
  if (from) qs.set("from", new Date(from).toISOString());
  if (to) qs.set("to", new Date(to).toISOString());
  const query = qs.toString();
  const href = `/api/proxy/users/interactions.csv${query ? `?${query}` : ""}`;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <span className="text-xs font-medium text-zinc-500">
        All interactions
      </span>
      <input
        type="datetime-local"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        aria-label="From (blank = beginning)"
        className="rounded-md border border-zinc-200 bg-white shadow-sm px-2 py-1 text-xs text-zinc-600"
      />
      <span className="text-xs text-zinc-400">to</span>
      <input
        type="datetime-local"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        aria-label="To (blank = now)"
        className="rounded-md border border-zinc-200 bg-white shadow-sm px-2 py-1 text-xs text-zinc-600"
      />
      <a
        href={href}
        download
        className="rounded-md border border-zinc-200 bg-white shadow-sm px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
      >
        Download all
      </a>
      <span className="text-[11px] text-zinc-400">
        blank dates = all time · CSV, one row per interaction
      </span>
    </div>
  );
}
