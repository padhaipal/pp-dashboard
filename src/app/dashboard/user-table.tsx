"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

interface DayActivity {
  date: string;
  count: number;
}

interface DashboardUser {
  id: string;
  name: string | null;
  external_id: string;
  activity: DayActivity[];
}

function ActivityGraph({ activity }: { activity: DayActivity[] }) {
  const max = Math.max(1, ...activity.map((d) => d.count));
  return (
    <div className="flex items-end gap-[3px] h-8">
      {activity.map((d) => {
        const h = Math.max(2, (d.count / max) * 32);
        return (
          <div
            key={d.date}
            title={`${d.date}: ${d.count}`}
            className="w-3 rounded-sm bg-emerald-500"
            style={{ height: `${h}px`, opacity: d.count === 0 ? 0.2 : 1 }}
          />
        );
      })}
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

export function UserTable() {
  const router = useRouter();
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);

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
    } finally {
      setLoading(false);
    }
  }, [users.length]);

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
              onClick={() => router.push(`/dashboard/user/${user.id}`)}
              className="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer"
            >
              <td className="py-2.5 px-4 text-zinc-400">{i + 1}</td>
              <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                <EditableName userId={user.id} initialName={user.name} />
              </td>
              <td className="py-2.5 px-4 font-mono text-zinc-600">
                {user.external_id}
              </td>
              <td className="py-2.5 px-4 text-zinc-400 italic">--</td>
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
