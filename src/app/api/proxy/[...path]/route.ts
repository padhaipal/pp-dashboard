import { auth } from "@/auth";
import { NextRequest } from "next/server";

async function proxyToSketch(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session || session.user.role !== "dev") {
    return new Response("Unauthorized", { status: 401 });
  }

  const { path } = await params;
  const target = `${process.env.PP_SKETCH_INTERNAL_URL}/${path.join("/")}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  const res = await fetch(target, init);
  const body = await res.text();

  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
  });
}

export const GET = proxyToSketch;
export const POST = proxyToSketch;
export const PUT = proxyToSketch;
export const PATCH = proxyToSketch;
export const DELETE = proxyToSketch;
