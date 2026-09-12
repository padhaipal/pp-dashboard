import { parseStyleParam, SEED_RE } from "@/app/d/[user_id]/avatar";
import { renderAvatarSvg } from "@/app/d/[user_id]/render-avatar";

export const runtime = "nodejs";

// GET /api/avatar/{sprouts|notionists}[-vN]/{seed} → static SVG, immutable-cached.
export async function GET(_req: Request, { params }: { params: Promise<{ style: string; seed: string }> }) {
  const { style: rawStyle, seed } = await params;
  const style = parseStyleParam(rawStyle);
  if (!style) return new Response("Not found", { status: 404 });
  if (!SEED_RE.test(seed)) return new Response("Bad seed", { status: 400 });

  const svg = renderAvatarSvg(style, seed);
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
