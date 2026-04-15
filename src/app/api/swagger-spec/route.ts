import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "dev") {
    return new Response("Unauthorized", { status: 401 });
  }

  const res = await fetch(`${process.env.PP_SKETCH_INTERNAL_URL}/api-json`);
  const spec = await res.json();

  // Point Swagger "Try it out" at our proxy instead of pp-sketch directly
  spec.servers = [{ url: "/api/proxy" }];

  return Response.json(spec);
}
