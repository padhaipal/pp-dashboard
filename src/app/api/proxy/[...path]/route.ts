import { auth } from "@/auth";
import { NextRequest } from "next/server";

const ADMIN_ALLOWED: { pattern: RegExp; methods: string[] }[] = [
  { pattern: /^users\/dashboard$/, methods: ["GET"] },
  { pattern: /^users\/[^/]+$/, methods: ["PATCH"] },
  { pattern: /^users\/[^/]+\/media$/, methods: ["GET"] },
  { pattern: /^users\/[^/]+\/scores$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/[^/]+\/audio$/, methods: ["GET"] },
  { pattern: /^media-meta-data\/[^/]+\/dashboard-transcript$/, methods: ["POST", "PATCH", "DELETE"] },
];

function isAdminAllowed(path: string, method: string): boolean {
  return ADMIN_ALLOWED.some((r) => r.pattern.test(path) && r.methods.includes(method));
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

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const res = await fetch(target, init);
  const contentType = res.headers.get("Content-Type") || "application/json";
  const body = contentType.startsWith("application/json") || contentType.startsWith("text/")
    ? await res.text()
    : await res.arrayBuffer();

  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": contentType },
  });
}

export const GET = proxyToSketch;
export const POST = proxyToSketch;
export const PUT = proxyToSketch;
export const PATCH = proxyToSketch;
export const DELETE = proxyToSketch;
