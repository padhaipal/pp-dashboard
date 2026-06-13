"use client";

import { useState, useEffect } from "react";

interface UserMetrics {
  days_since_signup: number;
  total_active_ms: number;
  days_over_five_min: number;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 px-4 py-3">
      <p className="text-2xl font-semibold text-zinc-900 tabular-nums">
        {value}
      </p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    </div>
  );
}

export function UserMetrics({ userId }: { userId: string }) {
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/proxy/users/${userId}/metrics`);
        if (!res.ok) return;
        const data: UserMetrics = await res.json();
        if (!cancelled) setMetrics(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 mb-6">
        <p className="text-zinc-400 text-sm text-center">Loading metrics...</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 mb-6">
        <p className="text-zinc-400 text-sm text-center">
          Metrics unavailable
        </p>
      </div>
    );
  }

  const totalMinutes = Math.round(metrics.total_active_ms / 60000);

  return (
    <div className="bg-white rounded-lg border border-zinc-200 shadow-sm mb-6 flex divide-x divide-zinc-200">
      <Stat
        value={`${metrics.days_since_signup}`}
        label="Days since signup"
      />
      <Stat value={`${totalMinutes}`} label="Total active minutes" />
      <Stat
        value={`${metrics.days_over_five_min}`}
        label="Days over 5 active min"
      />
    </div>
  );
}
