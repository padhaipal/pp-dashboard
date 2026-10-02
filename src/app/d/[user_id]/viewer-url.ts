// The public teacher dashboard has no session: the link's user id IS the
// viewer, and every proxy call carries it as `?viewer=` so the proxy can
// tell pp-sketch who is looking (api/proxy/[...path]/proxy-viewer.ts), which
// decides whose names, phones and recordings come back unmasked. No React,
// no DOM.

export const VIEWER_PARAM = "viewer";

export function withViewer(url: string, viewerId: string | null | undefined): string {
  if (!viewerId) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${VIEWER_PARAM}=${encodeURIComponent(viewerId)}`;
}
