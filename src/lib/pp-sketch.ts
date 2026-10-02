// The one place the dashboard talks to pp-sketch from the server. Every call
// carries the dashboard's badge (PP_SKETCH_API_KEY → x-api-key): pp-sketch
// rejects anything without it, so a missing key fails loudly here rather than
// as a wall of 401s.

export const API_KEY_HEADER = "x-api-key";

function requireEnv(name: "PP_SKETCH_INTERNAL_URL" | "PP_SKETCH_API_KEY"): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const ppSketchBaseUrl = (): string => requireEnv("PP_SKETCH_INTERNAL_URL").replace(/\/+$/, "");

// Headers for a pp-sketch request: the badge plus whatever the caller adds.
export function ppSketchHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set(API_KEY_HEADER, requireEnv("PP_SKETCH_API_KEY"));
  return headers;
}

// `path` is relative to the pp-sketch root ("users/abc/public", with or
// without a leading slash, query string included).
export function ppSketchFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${ppSketchBaseUrl()}/${path.replace(/^\/+/, "")}`;
  return fetch(url, { ...init, headers: ppSketchHeaders(init.headers) });
}
