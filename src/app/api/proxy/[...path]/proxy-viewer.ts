// Who is looking, for pp-sketch (auth/viewer.ts there). The public teacher
// dashboard (/d/[user_id]) has no session: the page appends `?viewer=<its
// user id>` to every proxy call (viewer-url.ts) and the proxy turns it into
// the x-pp-viewer-id header. A staff session (dev/admin) becomes
// x-pp-viewer-staff instead. The headers are set HERE and never copied from
// the browser, so a client cannot claim to be someone else; pp-sketch in
// turn only believes them from the dashboard's badge.

export const VIEWER_PARAM = "viewer";
export const VIEWER_ID_HEADER = "x-pp-viewer-id";
export const VIEWER_STAFF_HEADER = "x-pp-viewer-staff";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ViewerForward {
  headers: Record<string, string>;
  // The query string to forward, without the viewer param ("" or "?…").
  search: string;
}

// A `viewer` param means a /d page: it is seen AS that user, staff session
// or not — a dev opening a block official's link must not see the students'
// names and numbers that the official cannot (2026-10). Without the param
// (the staff pages) a staff session sees everything.
export function viewerForward(search: string, staff: boolean): ViewerForward {
  const params = new URLSearchParams(search);
  const viewer = params.get(VIEWER_PARAM);
  params.delete(VIEWER_PARAM);
  const rest = params.toString();
  const headers: Record<string, string> = {};
  if (viewer && UUID_RE.test(viewer)) headers[VIEWER_ID_HEADER] = viewer.toLowerCase();
  else if (staff && viewer === null) headers[VIEWER_STAFF_HEADER] = "1";
  return { headers, search: rest ? `?${rest}` : "" };
}

// Request headers that reach pp-sketch. Everything else — the session
// cookie above all — stays here; identity goes as the badge (lib/pp-sketch.ts)
// and the viewer headers from viewerForward(), never as whatever the browser
// sent.
const FORWARDED_REQUEST_HEADERS = ["content-type", "accept", "accept-language", "range"];

export function proxyRequestHeaders(incoming: Headers, viewer: Record<string, string>): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = incoming.get(name);
    if (value) headers.set(name, value);
  }
  for (const [name, value] of Object.entries(viewer)) headers.set(name, value);
  return headers;
}
