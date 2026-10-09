// Paths the proxy forwards WITHOUT a session (the public teacher dashboard
// at /d/[user_id]). Checked before auth() in route.ts. Personal data in
// these responses (names, phones, recordings) is masked by pp-sketch per
// viewer — the proxy only says who is looking (proxy-viewer.ts).
//
// NEVER add `^users/[^/]+$` here — the staff detail endpoint returns staff_notes.

export const PUBLIC_ALLOWED: { pattern: RegExp; methods: string[] }[] = [
  { pattern: /^users\/[^/]+\/public$/, methods: ["GET"] },
  { pattern: /^users\/[^/]+\/profile$/, methods: ["PATCH"] },
  { pattern: /^geo-entities\/[^/]+\/scores(\.csv)?$/, methods: ["GET"] },
  { pattern: /^geo-entities\/[^/]+\/spotlight$/, methods: ["GET"] },
  // most improved / top performing at a deeper level (the rankings' level toggle)
  { pattern: /^geo-entities\/[^/]+\/rankings$/, methods: ["GET"] },
  // Student modal on /d: score history, recent voice notes and one note's
  // audio bytes (403 from pp-sketch unless the viewer may hear it).
  { pattern: /^users\/[^/]+\/literacy-test-scores$/, methods: ["GET"] },
  // Student modal "Time" chart: the student's active minutes per day.
  { pattern: /^users\/[^/]+\/usage-history$/, methods: ["GET"] },
  { pattern: /^users\/[^/]+\/media$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/[^/]+\/audio$/, methods: ["GET"] },
  // Student modal letter-score chart: every score row (letters only, no
  // PII) and the learnt bins.
  { pattern: /^users\/[^/]+\/scores$/, methods: ["GET"] },
  { pattern: /^scores\/letter-bins$/, methods: ["GET"] },
];

// The media feed; its `onboarding` param is staff-only (below).
const PUBLIC_MEDIA_RE = /^users\/[^/]+\/media$/;

// `users/:id/media?onboarding=1` makes pp-sketch include the parent-onboarding
// voice notes (a parent stating the child's name and age, recorded before
// recording permission exists). Staff only: for a sessionless caller the
// param is removed before the request is forwarded, so the public /d modal
// can never ask for them. Returns the query string to forward ("" or "?…").
export const STAFF_ONLY_MEDIA_PARAM = "onboarding";

export function forwardedSearch(path: string, method: string, search: string, staff: boolean): string {
  if (staff || method !== "GET" || !PUBLIC_MEDIA_RE.test(path)) return search;
  const params = new URLSearchParams(search);
  if (!params.has(STAFF_ONLY_MEDIA_PARAM)) return search;
  params.delete(STAFF_ONLY_MEDIA_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

export function isPublicAllowed(path: string, method: string): boolean {
  return PUBLIC_ALLOWED.some((r) => r.pattern.test(path) && r.methods.includes(method));
}
