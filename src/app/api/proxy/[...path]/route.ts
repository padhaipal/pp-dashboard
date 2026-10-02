import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { ppSketchFetch } from "@/lib/pp-sketch";
import { NextRequest } from "next/server";
import { forwardedSearch, isPublicAllowed } from "./public-allowlist";
import { proxyRequestHeaders, viewerForward } from "./proxy-viewer";

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
  // Reversible sendable toggle on one media row (uuid-guarded upstream).
  { pattern: /^media-meta-data\/[^/]+$/, methods: ["PATCH"] },
  { pattern: /^media-meta-data\/[^/]+\/dashboard-transcript$/, methods: ["POST", "PATCH", "DELETE"] },
  { pattern: /^media-meta-data\/coverage$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/by-state-transition-id$/, methods: ["GET", "DELETE"] },
  { pattern: /^media-meta-data\/comprehension-stids$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/stid-counts$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/passage-stats$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/passages$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/passages\.csv$/, methods: ["GET"] },
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

// Response headers that reach the browser.
const FORWARDED_RESPONSE_HEADERS = ["Content-Type", "Content-Disposition", "Cache-Control", "Content-Range", "Accept-Ranges"];

function isAdminAllowed(path: string, method: string): boolean {
  return ADMIN_ALLOWED.some((r) => r.pattern.test(path) && r.methods.includes(method));
}

const isStaff = (role: string | undefined) => role === "dev" || role === "admin";

async function proxyToSketch(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const joined = path.join("/");

  // Public teacher-dashboard endpoints (/d/[user_id]) need no session; for
  // them a staff session, when there is one, still counts (the admin
  // /user/:id page reuses the same reads).
  let staff: boolean;
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
  } else {
    const session = await auth().catch(() => null);
    staff = isStaff(session?.user?.role);
  }

  const viewer = viewerForward(req.nextUrl.search, staff);
  // Staff-only query params (the media feed's `onboarding`) are dropped for
  // sessionless callers.
  const qs = forwardedSearch(joined, req.method, viewer.search, staff);

  logger.info(`proxy ${req.method} ${joined}${qs}`, "ProxyRoute");

  const init: RequestInit = {
    method: req.method,
    headers: proxyRequestHeaders(req.headers, viewer.headers),
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const res = await ppSketchFetch(`${joined}${qs}`, init);

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = res.headers.get(name);
    if (value) responseHeaders.set(name, value);
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
