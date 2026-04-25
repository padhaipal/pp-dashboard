import { NextRequest } from "next/server";

export const runtime = "nodejs";

const ALLOWED: { pattern: RegExp; methods: string[] }[] = [
  { pattern: /^answer$/, methods: ["POST"] },
  { pattern: /^answers$/, methods: ["GET"] },
  { pattern: /^stats$/, methods: ["GET"] },
  { pattern: /^subscribe$/, methods: ["POST"] },
];

function isAllowed(path: string, method: string): boolean {
  return ALLOWED.some((r) => r.pattern.test(path) && r.methods.includes(method));
}

async function proxyToSketch(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const joined = path.join("/");

  if (!isAllowed(joined, req.method)) {
    return new Response("Not Found", { status: 404 });
  }

  const qs = req.nextUrl.search;
  const target = `${process.env.PP_SKETCH_INTERNAL_URL}/quiz/${joined}${qs}`;

  const init: RequestInit = {
    method: req.method,
    headers: { "Content-Type": req.headers.get("content-type") ?? "application/json" },
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const res = await fetch(target, init);
  const body = await res.arrayBuffer();
  const headers = new Headers();
  const ct = res.headers.get("Content-Type");
  if (ct) headers.set("Content-Type", ct);

  return new Response(body, { status: res.status, headers });
}

export const GET = proxyToSketch;
export const POST = proxyToSketch;