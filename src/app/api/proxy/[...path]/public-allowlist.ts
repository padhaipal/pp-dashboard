// Paths the proxy forwards WITHOUT a session (the public teacher dashboard
// at /d/[user_id]). Checked before auth() in route.ts.
//
// NEVER add `^users/[^/]+$` here — the staff detail endpoint returns staff_notes.

export const PUBLIC_ALLOWED: { pattern: RegExp; methods: string[] }[] = [
  { pattern: /^users\/[^/]+\/public$/, methods: ["GET"] },
  { pattern: /^users\/[^/]+\/profile$/, methods: ["PATCH"] },
  { pattern: /^geo-entities\/[^/]+\/scores(\.csv)?$/, methods: ["GET"] },
  { pattern: /^geo-entities\/[^/]+\/spotlight$/, methods: ["GET"] },
];

export function isPublicAllowed(path: string, method: string): boolean {
  return PUBLIC_ALLOWED.some((r) => r.pattern.test(path) && r.methods.includes(method));
}
