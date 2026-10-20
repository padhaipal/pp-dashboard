// The public teacher dashboard has no session: the link's user id IS the
// viewer, and every proxy call carries it as `?viewer=` so the proxy can
// tell pp-sketch who is looking (api/proxy/[...path]/proxy-viewer.ts), which
// decides whose names, phones and recordings come back unmasked. No React,
// no DOM.

export const VIEWER_PARAM = "viewer";

// The general public (the donor page's map): no account behind it. Named
// explicitly so a logged-in staff browser is still answered as the public
// (the proxy never upgrades a request that names a viewer to staff), and
// not a uuid, so pp-sketch gets no viewer header and masks everything.
export const PUBLIC_VIEWER = "public";

export const isPublicViewer = (viewerId: string | null | undefined): boolean => viewerId === PUBLIC_VIEWER;

export function withViewer(url: string, viewerId: string | null | undefined): string {
  if (!viewerId) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${VIEWER_PARAM}=${encodeURIComponent(viewerId)}`;
}
