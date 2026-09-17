import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { isPublicAllowed, PUBLIC_MEDIA_RE } from "./public-allowlist";

export const runtime = "nodejs";

const ADMIN_ALLOWED: { pattern: RegExp; methods: string[] }[] = [
  { pattern: /^users\/dashboard$/, methods: ["GET"] },
  { pattern: /^users\/dashboard\/summary$/, methods: ["GET"] },
  { pattern: /^users\/[^/]+$/, methods: ["PATCH"] },
  { pattern: /^users\/[^/]+\/media$/, methods: ["GET"] },
  { pattern: /^users\/[^/]+\/metrics$/, methods: ["GET"] },
  { pattern: /^users\/[^/]+\/scores$/, methods: ["GET"] },
  { pattern: /^users\/[^/]+\/literacy-test-scores$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/[^/]+\/audio$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/[^/]+\/dashboard-transcript$/, methods: ["POST", "PATCH", "DELETE"] },
  { pattern: /^media-meta-data\/coverage$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/by-state-transition-id$/, methods: ["GET", "DELETE"] },
  { pattern: /^media-meta-data\/comprehension-stids$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/stid-counts$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/passage-stats$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/passages$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/generation-failures$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/llm-generate$/, methods: ["POST"] },
  { pattern: /^media-meta-data\/elevenlabs-generate$/, methods: ["POST"] },
  { pattern: /^media-meta-data\/upload-static$/, methods: ["POST"] },
  // GET :id = read-only single-row fetch (comprehension modal's passage row).
  { pattern: /^media-meta-data\/[^/]+$/, methods: ["GET", "DELETE"] },
  { pattern: /^scores\/letter-bins$/, methods: ["GET"] },
  // Staff onboarding (/onboarding)
  { pattern: /^geo-entities\/search$/, methods: ["GET"] },
  { pattern: /^geo-entities\/[^/]+$/, methods: ["GET"] },
  { pattern: /^geo-entities\/[^/]+\/descendants$/, methods: ["GET"] },
  { pattern: /^users\/staff-create$/, methods: ["POST"] },
  { pattern: /^users\/lookup$/, methods: ["GET"] },
  // PATCH on users/:id is already allowed above.
  { pattern: /^users\/[^/]+$/, methods: ["GET"] },
];

function isAdminAllowed(path: string, method: string): boolean {
  return ADMIN_ALLOWED.some((r) => r.pattern.test(path) && r.methods.includes(method));
}

function buildProxyRequestHeaders(req: NextRequest): Headers {
  const headers = new Headers(req.headers);

  // Let fetch recalculate hop-by-hop and body-specific headers.
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  return headers;
}

async function proxyToSketch(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const joined = path.join("/");

  // Public teacher-dashboard endpoints (/d/[user_id]) need no session.
  let staff = false;
  if (!isPublicAllowed(joined, req.method)) {
    const session = await auth();
    if (!session || !session.user) {
      return new Response("Unauthorized", { status: 401 });
    }
    const role = session.user.role;
    if (role !== "dev" && !(role === "admin" && isAdminAllowed(joined, req.method))) {
      return new Response("Unauthorized", { status: 401 });
    }
    staff = true;
  } else if (PUBLIC_MEDIA_RE.test(joined) && req.method === "GET") {
    // The media payload carries the student's phone: only a staff session
    // (the admin /user/:id page) may see it; the public /d modal gets it stripped.
    const session = await auth().catch(() => null);
    const role = session?.user?.role;
    staff = role === "dev" || role === "admin";
  }
  const stripPhone = !staff && PUBLIC_MEDIA_RE.test(joined) && req.method === "GET";
  const qs = req.nextUrl.search;
  const target = `${process.env.PP_SKETCH_INTERNAL_URL}/${path.join("/")}${qs}`;

  logger.info(`proxy ${req.method} ${joined}${qs}`, "ProxyRoute");

  const init: RequestInit = {
    method: req.method,
    headers: buildProxyRequestHeaders(req),
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const res = await fetch(target, init);

  const responseHeaders = new Headers();
  const contentType = res.headers.get("Content-Type");
  const contentDisposition = res.headers.get("Content-Disposition");
  const cacheControl = res.headers.get("Cache-Control");

  if (contentType) responseHeaders.set("Content-Type", contentType);
  if (contentDisposition) responseHeaders.set("Content-Disposition", contentDisposition);
  if (cacheControl) responseHeaders.set("Cache-Control", cacheControl);

  if (stripPhone && res.ok) {
    const body = (await res.json()) as { user?: { phone?: string } };
    if (body && body.user) delete body.user.phone;
    return Response.json(body, { status: res.status, headers: responseHeaders });
  }

  return new Response(res.body, {
    status: res.status,
    headers: responseHeaders,
  });
}

export const GET = proxyToSketch;
export const POST = proxyToSketch;
export const PUT = proxyToSketch;
export const PATCH = proxyToSketch;
export const DELETE = proxyToSketch;
