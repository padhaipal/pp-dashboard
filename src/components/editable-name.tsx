"use client";

import { useCallback, useState } from "react";

// Inline add/rename control for a user's name. Named users render as
// click-to-edit text (pencil on hover); nameless users get "+ add name".
// Saves via the existing PATCH /users/:id proxy endpoint. Clearing a name is
// deliberately unsupported (the endpoint ignores null); an operator can save
// whitespace to make a name look blank, so whitespace-only input is allowed
// and sent unaltered while normal input is trimmed.
export function EditableName({
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
  const [error, setError] = useState<string | null>(null);

  const startEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(name ?? "");
    setError(null);
    setEditing(true);
  };

  const save = useCallback(async () => {
    if (draft.length === 0) return;
    const value = draft.trim() || draft;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value }),
      });
      if (res.ok) {
        setName(value);
        setEditing(false);
      } else {
        setError(`Save failed (${res.status})`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [draft, userId]);

  if (!editing) {
    if (name) {
      return (
        <button
          onClick={startEditing}
          title="Rename"
          className="group inline-flex items-center gap-1 text-left hover:text-zinc-900"
        >
          <span>{name}</span>
          <span
            aria-hidden
            className="text-zinc-300 group-hover:text-zinc-500 text-xs"
          >
            ✎
          </span>
        </button>
      );
    }
    return (
      <button
        onClick={startEditing}
        className="text-xs text-zinc-400 hover:text-zinc-600 italic"
      >
        + add name
      </button>
    );
  }

  return (
    <form
      onClick={(e) => e.stopPropagation()}
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
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
        disabled={saving}
        className="w-28 border border-zinc-300 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
        placeholder="Name"
      />
      <button
        type="submit"
        disabled={saving || draft.length === 0}
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
      {error && <span className="text-xs text-red-600 ml-1">{error}</span>}
    </form>
  );
}
