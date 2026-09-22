"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

// Staff onboarding console: "Create / update" (new staff user + WhatsApp
// deep link, or a partial update when the number already belongs to a staff
// user) and "Find" (lookup, edit, deactivate/reactivate). Every backend call goes
// through /api/proxy/<path> to pp-sketch; the proxy allowlist in
// src/app/api/proxy/[...path]/route.ts must permit each path used here.

type GeoType = "school" | "block" | "district" | "state" | "country";
const GEO_TYPES: GeoType[] = ["school", "block", "district", "state", "country"];

// Role title auto-filled when a geo entity is picked (unless the operator
// has already typed a role by hand).
export const DEFAULT_ROLE_TITLE: Record<GeoType, string> = {
  school: "Teacher",
  block: "BEO",
  district: "BSA",
  state: "DGSE",
  country: "Minister",
};

export type GeoSelection = {
  id: string;
  type: string;
  code: string;
  name: string;
  parent_name: string | null;
};
type GeoSearchRow = GeoSelection & { status: string };
type GeoEntity = { id: string; type: string; code: string; name: string; status: string };

export type StaffUser = {
  id: string;
  external_id: string;
  name: string | null;
  role: string;
  role_title: string | null;
  staff_notes: string | null;
  geo_entity_id: string | null;
  geo_entity_name: string | null;
  geo_entity_type: string | null;
  deleted_at: string | null;
  link: string;
};
type StaffUserDetail = StaffUser & { geo_entity: GeoEntity | null; ancestors: GeoEntity[] };

// Display-only normalisation; pp-sketch does the authoritative validation.
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

// Nest error body: { statusCode, message: string | string[], error }.
async function serverMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join("; ");
    if (typeof body.message === "string") return body.message;
  } catch {
    // non-JSON body; fall through to status code
  }
  return `HTTP ${res.status}`;
}

function isStaffRole(role: string): boolean {
  return role !== "dev" && role !== "admin";
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const inputCls =
  "w-full border border-zinc-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-zinc-100";
const labelCls = "block text-xs font-medium text-zinc-600 mb-1";
const primaryBtnCls =
  "text-sm px-3 py-1 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-40";
const secondaryBtnCls =
  "text-sm px-3 py-1 border border-zinc-300 rounded text-zinc-700 hover:bg-zinc-100 disabled:opacity-40";

// ---------------------------------------------------------------- copy link

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={link} className={inputCls} onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className={secondaryBtnCls}
        onClick={() => {
          navigator.clipboard
            .writeText(link)
            .then(() => setCopied(true))
            .catch(() => setCopied(false));
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

// --------------------------------------------------------------- geo picker

function GeoPicker({
  value,
  onChange,
  disabled,
}: {
  value: GeoSelection | null;
  onChange: (geo: GeoSelection | null) => void;
  disabled?: boolean;
}) {
  const [type, setType] = useState<GeoType>("school");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ key: string; rows: GeoSearchRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounced(query.trim(), 300);
  const key = `${type}:${debounced}`;
  const rows = results?.key === key ? results.rows : null;

  useEffect(() => {
    if (debounced.length < 2) return;
    let cancelled = false;
    const params = new URLSearchParams({ q: debounced, type });
    fetch(`/api/proxy/geo-entities/search?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await serverMessage(res));
        return (await res.json()) as GeoSearchRow[];
      })
      .then((data) => {
        if (cancelled) return;
        setResults({ key: `${type}:${debounced}`, rows: data });
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setResults({ key: `${type}:${debounced}`, rows: [] });
        setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, type]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 border border-emerald-300 bg-emerald-50 rounded px-2 py-1 text-sm">
        <span className="text-zinc-800">
          <span className="font-medium">{value.name}</span> · {value.type} · {value.code}
          {value.parent_name ? ` · ${value.parent_name}` : ""}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          className="text-xs text-zinc-500 hover:text-zinc-800 underline"
        >
          Clear
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as GeoType)}
          disabled={disabled}
          aria-label="Geo entity type"
          className="border border-zinc-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {GEO_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          placeholder="Search by name or code"
          aria-label="Geo entity search"
          className={inputCls}
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {rows && rows.length > 0 && (
        <ul className="mt-1 border border-zinc-200 rounded divide-y divide-zinc-100 max-h-56 overflow-y-auto bg-white">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    id: r.id,
                    type: r.type,
                    code: r.code,
                    name: r.name,
                    parent_name: r.parent_name,
                  })
                }
                className="w-full text-left px-2 py-1 text-sm hover:bg-emerald-50"
              >
                {r.name} · {r.type} · {r.code} · {r.parent_name ?? "—"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {rows && rows.length === 0 && !error && (
        <p className="text-xs text-zinc-400 mt-1">No matches</p>
      )}
    </div>
  );
}

// --------------------------------------------------------------- staff form

type FormValues = {
  name: string;
  phone: string;
  geo: GeoSelection | null;
  roleTitle: string;
  notes: string;
  // True once the operator has typed a role by hand; blocks the
  // DEFAULT_ROLE_TITLE prefill from overwriting it.
  roleTouched: boolean;
};

const EMPTY_FORM: FormValues = {
  name: "",
  phone: "",
  geo: null,
  roleTitle: "",
  notes: "",
  roleTouched: false,
};

// Which fields must be filled besides the phone. Create needs both; an
// update of an existing staff user needs neither (blank keeps the stored
// value); promoting a student needs a geo entity and a name if it has none.
type Required = { name: boolean; geo: boolean };
const REQUIRE_ALL: Required = { name: true, geo: true };

function canSubmit(v: FormValues, required: Required = REQUIRE_ALL): boolean {
  if (normalisePhone(v.phone).length === 0) return false;
  if (required.name && v.name.trim().length === 0) return false;
  if (required.geo && v.geo === null) return false;
  return true;
}

function StaffForm({
  values,
  onChange,
  onSubmit,
  submitLabel,
  busy,
  submitDisabled,
  required = REQUIRE_ALL,
  phoneNote,
}: {
  values: FormValues;
  onChange: (next: FormValues) => void;
  onSubmit: () => void;
  submitLabel: string;
  busy: boolean;
  submitDisabled?: boolean;
  required?: Required;
  // Rendered under the WhatsApp number (Create tab: existing-user notice).
  phoneNote?: ReactNode;
}) {
  const uid = useId();
  const [phoneBlurred, setPhoneBlurred] = useState(false);
  const set = (patch: Partial<FormValues>) => onChange({ ...values, ...patch });
  const normalised = normalisePhone(values.phone);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-3"
    >
      <div>
        <label htmlFor={`${uid}-name`} className={labelCls}>
          Full name
        </label>
        <input
          id={`${uid}-name`}
          value={values.name}
          onChange={(e) => set({ name: e.target.value })}
          disabled={busy}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor={`${uid}-phone`} className={labelCls}>
          WhatsApp number
        </label>
        <input
          id={`${uid}-phone`}
          value={values.phone}
          onChange={(e) => set({ phone: e.target.value })}
          onBlur={() => setPhoneBlurred(true)}
          disabled={busy}
          inputMode="tel"
          placeholder="10-digit number or full international"
          className={inputCls}
        />
        {phoneBlurred && normalised.length === 0 && (
          <p className="text-xs text-red-600 mt-1">WhatsApp number required</p>
        )}
        {phoneBlurred && normalised.length > 0 && (
          <p className="text-xs text-zinc-500 mt-1">
            Will be saved as <code className="text-zinc-800">{normalised}</code>
          </p>
        )}
        {phoneNote}
      </div>
      <div>
        <span className={labelCls}>Geo entity</span>
        <p className="text-xs text-zinc-500 mb-1">
          Codes nest, e.g. a school in Lucknow, Uttar Pradesh: school P.S. NARHI <code>09270904601</code> · block
          NAGAR KSHETRA ZONE-3 <code>092712</code> · district LUCKNOW <code>0927</code> · state UTTAR PRADESH{" "}
          <code>09</code>. Pick the type, then search by name or code.
        </p>
        <GeoPicker
          value={values.geo}
          disabled={busy}
          onChange={(geo) => {
            const prefill =
              geo && !values.roleTouched
                ? DEFAULT_ROLE_TITLE[geo.type as GeoType] ?? values.roleTitle
                : values.roleTitle;
            set({ geo, roleTitle: prefill });
          }}
        />
      </div>
      <div>
        <label htmlFor={`${uid}-role`} className={labelCls}>
          Role
        </label>
        <p className="text-xs text-zinc-500 mb-1">
          Filled in from the geo entity type ({GEO_TYPES.map((t) => `${t}: ${DEFAULT_ROLE_TITLE[t]}`).join(", ")});
          type over it to use a different title.
        </p>
        <input
          id={`${uid}-role`}
          value={values.roleTitle}
          onChange={(e) => set({ roleTitle: e.target.value, roleTouched: true })}
          disabled={busy}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor={`${uid}-notes`} className={labelCls}>
          Notes
        </label>
        <textarea
          id={`${uid}-notes`}
          value={values.notes}
          onChange={(e) => set({ notes: e.target.value })}
          disabled={busy}
          rows={3}
          className={inputCls}
        />
      </div>
      <button
        type="submit"
        disabled={busy || submitDisabled || !canSubmit(values, required)}
        className={primaryBtnCls}
      >
        {busy ? "..." : submitLabel}
      </button>
    </form>
  );
}

// ------------------------------------------------------- create / update tab

type Verb = "Created" | "Updated" | "Promoted";
type CreateResult =
  | { ok: true; verb: Verb; name: string; link: string }
  | { ok: false; verb: "created" | "updated" | "promoted"; message: string };

// What the number resolves to. "blocked" covers dev/admin accounts and any
// deactivated account: the tab must not touch either.
type Mode = "create" | "update" | "promote" | "blocked";

function isProtectedRole(role: string): boolean {
  return role === "dev" || role === "admin";
}

function modeFor(row: StaffUser | null): Mode {
  if (!row) return "create";
  if (isProtectedRole(row.role) || row.deleted_at !== null) return "blocked";
  if (row.role === "student") return "promote";
  return "update";
}

// Exact-match lookup across every role (any_role=1); null when the number
// belongs to nobody.
async function findByPhone(phone: string): Promise<StaffUser | null> {
  const params = new URLSearchParams({ q: phone, any_role: "1" });
  const res = await fetch(`/api/proxy/users/lookup?${params.toString()}`);
  if (!res.ok) throw new Error(await serverMessage(res));
  const rows = (await res.json()) as StaffUser[];
  return rows.find((u) => u.external_id === phone) ?? null;
}

// Result of the debounced lookup, keyed by phone so a stale response never
// applies to the number now in the field.
type PhoneLookup = { phone: string; row: StaffUser | null };

const SUBMIT_LABEL: Record<Mode, string> = {
  create: "Create user",
  update: "Update user",
  promote: "Promote to staff",
  blocked: "Create user",
};

function CreateTab() {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [lookup, setLookup] = useState<PhoneLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const phone = normalisePhone(values.phone);
  const debouncedPhone = useDebounced(phone, 300);
  // Only a settled lookup for the current number counts; while it is in
  // flight (or the number is too short) the form behaves as "create". The
  // submit handler re-checks the number so this only drives the UI.
  const existing = lookup?.phone === phone ? lookup.row : null;
  const mode = modeFor(existing);
  const required: Required = {
    name: mode === "create" || (mode === "promote" && !existing?.name),
    geo: mode === "create" || mode === "promote",
  };

  useEffect(() => {
    if (debouncedPhone.length < 10) return;
    let cancelled = false;
    findByPhone(debouncedPhone)
      .then((row) => {
        if (cancelled) return;
        setLookup({ phone: debouncedPhone, row });
        setLookupError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setLookup({ phone: debouncedPhone, row: null });
        setLookupError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedPhone]);

  // Fresh lookup at submit time: the debounced one can be stale or missing
  // (number typed before hydration, fast paste-and-submit).
  const submit = async () => {
    setBusy(true);
    setResult(null);
    try {
      const row = await findByPhone(phone);
      setLookup({ phone, row });
      switch (modeFor(row)) {
        case "create":
          await create();
          break;
        case "update":
          await patch(row!, "Updated", {});
          break;
        case "promote":
          await promote(row!);
          break;
        case "blocked":
          setResult({ ok: false, verb: "updated", message: blockedMessage(row!) });
          break;
      }
    } catch (err) {
      setResult({ ok: false, verb: "created", message: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!values.geo) {
      setResult({ ok: false, verb: "created", message: "pick a geo entity" });
      return;
    }
    const name = values.name.trim();
    if (!name) {
      setResult({ ok: false, verb: "created", message: "full name required" });
      return;
    }
    const body: Record<string, string> = {
      name,
      external_id: phone,
      geo_entity_id: values.geo.id,
    };
    if (values.roleTitle.trim()) body.role_title = values.roleTitle.trim();
    if (values.notes.trim()) body.staff_notes = values.notes.trim();

    const res = await fetch("/api/proxy/users/staff-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setResult({ ok: false, verb: "created", message: await serverMessage(res) });
      return;
    }
    const data = (await res.json()) as { user: StaffUser; link: string };
    setResult({ ok: true, verb: "Created", name, link: data.link });
    setValues(EMPTY_FORM);
  };

  // A student becomes education_official. Needs a geo entity (and a name if
  // the learner record has none) — the same minimum a fresh staff row gets.
  const promote = async (user: StaffUser) => {
    if (!values.geo) {
      setResult({ ok: false, verb: "promoted", message: "pick a geo entity" });
      return;
    }
    if (!user.name && !values.name.trim()) {
      setResult({ ok: false, verb: "promoted", message: "full name required" });
      return;
    }
    await patch(user, "Promoted", { role: "education_official" });
  };

  // PATCH users/:id with `extra` plus only the non-blank fields, so a blank
  // field keeps its stored value.
  const patch = async (user: StaffUser, verb: "Updated" | "Promoted", extra: Record<string, string>) => {
    const body: Record<string, string> = { ...extra };
    if (values.name.trim()) body.name = values.name.trim();
    if (values.geo) body.new_geo_entity_id = values.geo.id;
    if (values.roleTitle.trim()) body.new_role_title = values.roleTitle.trim();
    if (values.notes.trim()) body.new_staff_notes = values.notes.trim();
    const failVerb = verb === "Promoted" ? "promoted" : "updated";
    if (Object.keys(body).length === 0) {
      setResult({ ok: false, verb: failVerb, message: "fill in at least one field to change" });
      return;
    }

    const res = await fetch(`/api/proxy/users/${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setResult({ ok: false, verb: failVerb, message: await serverMessage(res) });
      return;
    }
    const name = body.name ?? user.name ?? user.external_id;
    setResult({ ok: true, verb, name, link: user.link });
    setValues(EMPTY_FORM);
  };

  const phoneNote = existing ? (
    <ExistingNote row={existing} mode={mode} />
  ) : lookupError ? (
    <p className="text-xs text-red-600 mt-1">Could not check for an existing user — {lookupError}</p>
  ) : null;

  return (
    <div className="space-y-4">
      {result && result.ok && (
        <div className="border border-emerald-300 bg-emerald-50 rounded p-3 space-y-2 text-sm">
          <p className="text-emerald-800">
            {result.verb}. Send this link to {result.name}:
          </p>
          <CopyLink link={result.link} />
        </div>
      )}
      {result && !result.ok && (
        <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-3">
          Not {result.verb} — {result.message}
        </p>
      )}
      <StaffForm
        values={values}
        onChange={setValues}
        onSubmit={submit}
        submitLabel={SUBMIT_LABEL[mode]}
        busy={busy}
        required={required}
        submitDisabled={mode === "blocked"}
        phoneNote={phoneNote}
      />
    </div>
  );
}

function blockedMessage(row: StaffUser): string {
  const who = row.name ?? "(no name)";
  if (isProtectedRole(row.role)) {
    return `this number belongs to a ${row.role} account (${who}), which cannot be managed here`;
  }
  return `this number belongs to a deactivated account (${who}). Please contact the next level up the Lifteracy hierarchy about reactivating it`;
}

function ExistingNote({ row, mode }: { row: StaffUser; mode: Mode }) {
  const who = row.name ?? "(no name)";
  if (mode === "blocked") {
    return (
      <p className="text-xs text-red-600 mt-1">
        {isProtectedRole(row.role)
          ? `This number belongs to a ${row.role} account (${who}) and cannot be managed here.`
          : `This number belongs to a deactivated account (${who}) and cannot be updated here. Please contact the next level up the Lifteracy hierarchy about reactivating it.`}
      </p>
    );
  }
  if (mode === "promote") {
    return (
      <p className="text-xs text-emerald-800 mt-1">
        Existing learner: {who} (student). Submitting promotes this account to staff; pick a geo entity
        {row.name ? "" : " and enter a name"}. Blank fields keep their current values.
      </p>
    );
  }
  return (
    <p className="text-xs text-emerald-800 mt-1">
      Existing user: {who}
      {row.role_title ? ` · ${row.role_title}` : ""}
      {row.geo_entity_name ? ` · ${row.geo_entity_name}` : ""}. Submitting updates this user; blank fields
      keep their current values.
    </p>
  );
}

// ----------------------------------------------------------------- find tab

// `ancestors` is root-first (country → … → block), so the direct parent is last.
function toForm(d: StaffUserDetail): FormValues {
  return {
    name: d.name ?? "",
    phone: d.external_id,
    geo: d.geo_entity
      ? {
          id: d.geo_entity.id,
          type: d.geo_entity.type,
          code: d.geo_entity.code,
          name: d.geo_entity.name,
          parent_name: d.ancestors[d.ancestors.length - 1]?.name ?? null,
        }
      : null,
    roleTitle: d.role_title ?? "",
    notes: d.staff_notes ?? "",
    roleTouched: (d.role_title ?? "").length > 0,
  };
}

// Only fields that differ from the loaded record are sent.
function diffPatch(d: StaffUserDetail, v: FormValues): Record<string, string> {
  const patch: Record<string, string> = {};
  if (v.name.trim() !== (d.name ?? "")) patch.name = v.name.trim();
  if (normalisePhone(v.phone) !== d.external_id) patch.phone = normalisePhone(v.phone);
  if (v.geo && v.geo.id !== d.geo_entity_id) patch.new_geo_entity_id = v.geo.id;
  if (v.roleTitle.trim() !== (d.role_title ?? "")) patch.new_role_title = v.roleTitle.trim();
  if (v.notes.trim() !== (d.staff_notes ?? "")) patch.new_staff_notes = v.notes.trim();
  return patch;
}

function EditPanel({
  id,
  onBack,
  onChanged,
}: {
  id: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<StaffUserDetail | null>(null);
  const [values, setValues] = useState<FormValues | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/proxy/users/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await serverMessage(res));
        return (await res.json()) as StaffUserDetail;
      })
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setValues(toForm(d));
        setLoadError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/proxy/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setStatus({ ok: false, text: `Not saved — ${await serverMessage(res)}` });
        return;
      }
      setStatus({ ok: true, text: "Saved" });
      setVersion((v) => v + 1);
      onChanged();
    } catch (err) {
      setStatus({ ok: false, text: `Not saved — ${(err as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  const backBtn = (
    <button type="button" onClick={onBack} className="text-xs text-zinc-500 hover:text-zinc-800 underline">
      ← Back to results
    </button>
  );

  if (loadError) {
    return (
      <div className="space-y-2">
        {backBtn}
        <p className="text-sm text-red-600">{loadError}</p>
      </div>
    );
  }
  if (!detail || !values) {
    return (
      <div className="space-y-2">
        {backBtn}
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }
  if (!isStaffRole(detail.role)) {
    return (
      <div className="space-y-2">
        {backBtn}
        <p className="text-sm text-zinc-500">Not a staff user.</p>
      </div>
    );
  }

  const pending = diffPatch(detail, values);
  const hasChanges = Object.keys(pending).length > 0;
  const deactivated = detail.deleted_at !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {backBtn}
        {deactivated && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700">Deactivated</span>
        )}
      </div>
      {status && (
        <p className={`text-sm ${status.ok ? "text-emerald-700" : "text-red-600"}`}>{status.text}</p>
      )}
      <StaffForm
        values={values}
        onChange={setValues}
        onSubmit={() => {
          if (hasChanges) patch(pending);
        }}
        submitLabel="Save"
        busy={busy}
        submitDisabled={!hasChanges}
      />
      <div>
        <span className={labelCls}>Link</span>
        <CopyLink link={detail.link} />
      </div>
      <div className="pt-2 border-t border-zinc-200">
        {deactivated ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ reactivate: true })}
            className={secondaryBtnCls}
          >
            Reactivate
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ deactivate: true })}
            className="text-sm px-3 py-1 border border-red-300 rounded text-red-700 hover:bg-red-50 disabled:opacity-40"
          >
            Deactivate
          </button>
        )}
      </div>
    </div>
  );
}

function FindTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ key: string; rows: StaffUser[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const debounced = useDebounced(query.trim(), 300);
  const key = `${debounced}#${listVersion}`;
  const rows = results?.key === key ? results.rows : null;

  useEffect(() => {
    if (debounced.length < 2) return;
    let cancelled = false;
    const params = new URLSearchParams({ q: debounced });
    fetch(`/api/proxy/users/lookup?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await serverMessage(res));
        return (await res.json()) as StaffUser[];
      })
      .then((data) => {
        if (cancelled) return;
        setResults({ key: `${debounced}#${listVersion}`, rows: data.filter((u) => isStaffRole(u.role)) });
        setError(null);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setResults({ key: `${debounced}#${listVersion}`, rows: [] });
        setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, listVersion]);

  if (editingId) {
    return (
      <EditPanel
        key={editingId}
        id={editingId}
        onBack={() => setEditingId(null)}
        onChanged={() => setListVersion((v) => v + 1)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or phone"
        aria-label="Staff search"
        className={inputCls}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {rows && rows.length === 0 && !error && <p className="text-xs text-zinc-400">No matches</p>}
      {rows && rows.length > 0 && (
        <ul className="border border-zinc-200 rounded divide-y divide-zinc-100 bg-white">
          {rows.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setEditingId(u.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 flex items-center justify-between gap-3"
              >
                <span className="min-w-0">
                  <span className="font-medium text-zinc-900">{u.name ?? "(no name)"}</span>
                  <span className="text-zinc-500"> · {u.external_id}</span>
                  {u.role_title && <span className="text-zinc-500"> · {u.role_title}</span>}
                  {u.geo_entity_name && <span className="text-zinc-500"> · {u.geo_entity_name}</span>}
                </span>
                {u.deleted_at !== null && (
                  <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700">
                    Deactivated
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ console

type Tab = "create" | "find";

export function OnboardingConsole() {
  const [tab, setTab] = useState<Tab>("create");
  const tabCls = (t: Tab) =>
    `px-3 py-1.5 text-sm rounded-t border-b-2 ${
      tab === t
        ? "border-emerald-500 text-zinc-900 font-medium"
        : "border-transparent text-zinc-500 hover:text-zinc-800"
    }`;

  return (
    <div className="bg-white rounded-lg border border-zinc-200 shadow-sm">
      <div className="flex gap-1 border-b border-zinc-200 px-3" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "create"} className={tabCls("create")} onClick={() => setTab("create")}>
          Create / update
        </button>
        <button type="button" role="tab" aria-selected={tab === "find"} className={tabCls("find")} onClick={() => setTab("find")}>
          Find
        </button>
      </div>
      <div className="p-4 max-w-xl">{tab === "create" ? <CreateTab /> : <FindTab />}</div>
    </div>
  );
}
