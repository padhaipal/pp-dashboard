import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { MODELS, callModel, type ChatMessage } from "@/app/llm/models";

export const runtime = "nodejs";

// One model per request. The client fires these in parallel (one per selected
// model) so results render progressively as each provider responds.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { modelId?: string; messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const def = MODELS.find((m) => m.id === body.modelId);
  if (!def) {
    return Response.json({ error: `Unknown modelId: ${body.modelId}` }, { status: 400 });
  }
  if (!process.env[def.envKey]) {
    return Response.json({ error: `Missing ${def.envKey}` }, { status: 400 });
  }
  const messages = (body.messages ?? []).filter((m) => m.content?.trim());
  if (messages.length === 0) {
    return Response.json({ error: "No messages provided" }, { status: 400 });
  }

  const result = await callModel(def, messages);
  return Response.json(result);
}
