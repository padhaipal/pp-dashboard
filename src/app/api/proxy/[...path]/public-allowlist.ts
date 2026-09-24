// Paths the proxy forwards WITHOUT a session (the public teacher dashboard
// at /d/[user_id]). Checked before auth() in route.ts.
//
// NEVER add `^users/[^/]+$` here — the staff detail endpoint returns staff_notes.

export const PUBLIC_ALLOWED: { pattern: RegExp; methods: string[] }[] = [
  { pattern: /^users\/[^/]+\/public$/, methods: ["GET"] },
  { pattern: /^users\/[^/]+\/profile$/, methods: ["PATCH"] },
  { pattern: /^geo-entities\/[^/]+\/scores(\.csv)?$/, methods: ["GET"] },
  { pattern: /^geo-entities\/[^/]+\/spotlight$/, methods: ["GET"] },
  // Student modal on /d: score history, recent voice notes (phone stripped
  // by route.ts for sessionless callers) and one note's audio bytes.
  { pattern: /^users\/[^/]+\/literacy-test-scores$/, methods: ["GET"] },
  { pattern: /^users\/[^/]+\/media$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/[^/]+\/audio$/, methods: ["GET"] },
  // Student modal letter-score chart: every score row (letters only, no
  // PII) and the learnt bins (phone stripped by route.ts for sessionless
  // callers).
  { pattern: /^users\/[^/]+\/scores$/, methods: ["GET"] },
  { pattern: /^scores\/letter-bins$/, methods: ["GET"] },
];

// Letter-bins rows carry `userPhone`; sessionless callers get it removed
// (route.ts).
export const PUBLIC_LETTER_BINS_RE = /^scores\/letter-bins$/;

// Public media responses carry the student's phone; sessionless callers get
// it removed (route.ts).
export const PUBLIC_MEDIA_RE = /^users\/[^/]+\/media$/;

export function isPublicAllowed(path: string, method: string): boolean {
  return PUBLIC_ALLOWED.some((r) => r.pattern.test(path) && r.methods.includes(method));
}
