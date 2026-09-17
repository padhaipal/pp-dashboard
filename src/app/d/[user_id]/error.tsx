"use client";

// Error boundary for the public dashboard. Next's default page ("This page
// couldn't load") hides the message, which makes a teacher's screenshot
// useless for debugging; show the error text + digest and offer a retry.

import { useEffect } from "react";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaces in the browser console (and any client error reporting).
    console.error("[/d] dashboard error", error);
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white px-6 py-8 text-center shadow-sm">
        <div className="text-lg font-bold text-zinc-900">Something went wrong on this dashboard</div>
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-100 p-3 text-left text-xs text-zinc-700" data-testid="dashboard-error">
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={reset} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700">
            Try again
          </button>
          <button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
            Reload
          </button>
        </div>
        <div className="mt-3 text-[11px] text-zinc-400">Please send a screenshot of this box to Lifteracy.</div>
      </div>
    </div>
  );
}
