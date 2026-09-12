// Avatar URL helpers shared by the server page, the client dashboard and the
// /api/avatar route. DiceBear runs ONLY on our server (see render-avatar.ts);
// api.dicebear.com is never called.

export const AVATAR_STYLE = "sprouts" as const;
export const AVATAR_STYLES = ["sprouts", "notionists"] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];
// major of @dicebear/core + @dicebear/styles in package.json — part of the URL so a
// package upgrade that changes rendering busts the immutable cache.
export const AVATAR_PKG_MAJOR = 10;
export const SEED_RE = /^[A-Za-z0-9-]{1,64}$/;

export const avatarUrl = (seed: string, style: AvatarStyle = AVATAR_STYLE) =>
  `/api/avatar/${style}-v${AVATAR_PKG_MAJOR}/${encodeURIComponent(seed)}`;

// Falls back to a stable per-user seed when the profile has none.
export const seedFor = (avatarSeed: string | null | undefined, fallback: string) =>
  avatarSeed && SEED_RE.test(avatarSeed) ? avatarSeed : fallback.replace(/[^A-Za-z0-9-]/g, "").slice(0, 64) || "lifteracy";

// New random seed for the profile "Shuffle" button (matches SEED_RE).
export function randomSeed(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Accepts "sprouts" or "sprouts-v10" (the version suffix is stripped).
export function parseStyleParam(raw: string): AvatarStyle | null {
  const base = raw.replace(/-v\d+$/, "");
  return (AVATAR_STYLES as readonly string[]).includes(base) ? (base as AvatarStyle) : null;
}
