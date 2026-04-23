import { auth } from "@/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const ADMIN_ALLOWED: { pattern: RegExp; methods: string[] }[] = [
  { pattern: /^users\/dashboard$/, methods: ["GET"] },
  { pattern: /^users\/[^/]+$/, methods: ["PATCH"] },
  { pattern: /^users\/[^/]+\/media$/, methods: ["GET"] },
  { pattern: /^users\/[^/]+\/scores$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/[^/]+\/audio$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/[^/]+\/dashboard-transcript$/, methods: ["POST", "PATCH", "DELETE"] },
  { pattern: /^media-meta-data\/coverage$/, methods: ["GET"] },
  { pattern: /^scores\/letters-learnt$/, methods: ["GET"] },
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
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { path } = await params;
  const joined = path.join("/");
  const role = session.user.role;

  if (role !== "dev" && !(role === "admin" && isAdminAllowed(joined, req.method))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const qs = req.nextUrl.search;
  const target = `${process.env.PP_SKETCH_INTERNAL_URL}/${path.join("/")}${qs}`;

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
