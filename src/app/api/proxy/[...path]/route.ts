import { auth } from "@/auth";
import { NextRequest } from "next/server";

async function proxyToSketch(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session || session.user.role !== "dev") {
    return new Response("Unauthorized", { status: 401 });
  }

  const { path } = await params;
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
