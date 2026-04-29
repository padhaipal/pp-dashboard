"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

interface DayActivity {
  date: string;
  active_ms: number;
}

interface DashboardUser {
  id: string;
  name: string | null;
  external_id: string;
  activity: DayActivity[];
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const CHART_H = 32;

function formatActiveMs(ms: number): string {
  if (ms === 0) return "0s";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function ActivityGraph({ activity }: { activity: DayActivity[] }) {
  const maxMs = Math.max(
    FIVE_MINUTES_MS,
    ...activity.map((d) => d.active_ms),
    1
  );
  const fiveMinTop = CHART_H - (FIVE_MINUTES_MS / maxMs) * CHART_H;
  return (
    <div className="relative" style={{ height: CHART_H }}>
      <div className="flex items-end gap-[3px] h-full">
        {activity.map((d) => {
          const ratio = d.active_ms / maxMs;
          const h = Math.max(2, ratio * CHART_H);
          const isActive = d.active_ms >= FIVE_MINUTES_MS;
          return (
            <div
              key={d.date}
              title={`${d.date}: ${formatActiveMs(d.active_ms)}`}
              className={`w-3 rounded-sm ${
                isActive ? "bg-emerald-500" : "bg-red-500"
              }`}
              style={{
                height: `${h}px`,
                opacity: d.active_ms === 0 ? 0.25 : 1,
              }}
            />
          );
        })}
      </div>
      <div
        className="absolute left-0 right-0 border-t border-dashed border-zinc-400 pointer-events-none"
        style={{ top: `${fiveMinTop}px` }}
        aria-hidden
      />
    </div>
  );
}

function EditableName({
  userId,
  initialName,
}: {
  userId: string;
  initialName: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/proxy/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.trim() }),
      });
      if (res.ok) {
        setName(draft.trim());
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }, [draft, userId]);

  if (name) return <span>{name}</span>;

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-zinc-400 hover:text-zinc-600 italic"
      >
        + add name
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex items-center gap-1"
    >
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={saving}
        className="w-28 border border-zinc-300 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
        placeholder="Name"
      />
      <button
        type="submit"
        disabled={saving || !draft.trim()}
        className="text-xs px-1.5 py-0.5 bg-emerald-500 text-white rounded disabled:opacity-40"
      >
        {saving ? "..." : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-zinc-400 hover:text-zinc-600"
      >
        Cancel
      </button>
    </form>
  );
}

interface LetterBinsResult {
  userId: string;
  userPhone: string;
  bins: {
    untouched: string[];
    regressed: string[];
    learnt: string[];
    improved: string[];
  };
}

export function UserTable() {
  const router = useRouter();
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lettersMap, setLettersMap] = useState<Map<string, string[]>>(
    new Map()
  );

  const fetchLettersLearnt = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;
    try {
      const param = userIds.join(",");
      const res = await fetch(
        `/api/proxy/scores/letter-bins?users=${encodeURIComponent(param)}`
      );
      if (!res.ok) return;
      const data: LetterBinsResult[] = await res.json();
      setLettersMap((prev) => {
        const next = new Map(prev);
        for (const entry of data) {
          next.set(entry.userId, entry.bins.learnt);
        }
        return next;
      });
    } catch {
      // Letters learnt is non-critical; silently ignore failures
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proxy/users/dashboard?offset=${users.length}`
      );
      if (!res.ok) return;
      const data: DashboardUser[] = await res.json();
      setUsers((prev) => [...prev, ...data]);
      if (data.length < 100) setHasMore(false);
      setLoaded(true);
      fetchLettersLearnt(data.map((u) => u.id));
    } finally {
      setLoading(false);
    }
  }, [users.length, fetchLettersLearnt]);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-500 text-xs uppercase tracking-wide">
            <th className="py-3 px-4 font-medium">#</th>
            <th className="py-3 px-4 font-medium">Name</th>
            <th className="py-3 px-4 font-medium">Phone</th>
            <th className="py-3 px-4 font-medium">Letters Learnt</th>
            <th className="py-3 px-4 font-medium">Activity (7d)</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, i) => (
            <tr
              key={user.id}
              onClick={() => router.push(`/user/${user.id}`)}
              className="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer"
            >
              <td className="py-2.5 px-4 text-zinc-400">{i + 1}</td>
              <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                <EditableName userId={user.id} initialName={user.name} />
              </td>
              <td className="py-2.5 px-4 font-mono text-zinc-600">
                {user.external_id}
              </td>
              <td className="py-2.5 px-4">
                {lettersMap.has(user.id) ? (
                  lettersMap.get(user.id)!.length > 0 ? (
                    <span className="text-zinc-700">
                      {lettersMap.get(user.id)!.join(" ")}
                    </span>
                  ) : (
                    <span className="text-zinc-400 italic">none</span>
                  )
                ) : (
                  <span className="text-zinc-300 italic">...</span>
                )}
              </td>
              <td className="py-2.5 px-4">
                <ActivityGraph activity={user.activity} />
              </td>
            </tr>
          ))}
          {loading && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-zinc-400">
                Loading...
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {hasMore && loaded && (
        <div className="flex justify-center py-4">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="px-4 py-2 text-sm bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md transition-colors disabled:opacity-40"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
      {!hasMore && loaded && (
        <p className="text-center py-4 text-xs text-zinc-400">
          All users loaded
        </p>
      )}
    </div>
  );
}
