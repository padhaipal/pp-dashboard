import type { Metadata } from "next";
import { DonorPage } from "@/components/donor/donor-page";
import type { GeoRef } from "./d/[user_id]/dashboard-types";
import { readIncompleteStates } from "./d/[user_id]/incomplete-states";
import { ppSketchFetch } from "@/lib/pp-sketch";

// The public donor page (2026-10; was a redirect to /dashboard — staff go
// to /dashboard directly). No session needed.
export const metadata: Metadata = {
  title: "LIFTeracy",
  description: "LIFTeracy is a one-on-one AI tutor that teaches children in India to read Hindi through evening WhatsApp voice message conversations.",
};
export const dynamic = "force-dynamic";

// The country the "Measuring Every Child" map opens on: resolved
// server-side with the dashboard's badge (geo-entities/search is staff-only
// through the proxy); null when pp-sketch is unreachable — the page still
// renders, the map says it is unavailable.
async function india(): Promise<GeoRef | null> {
  try {
    const res = await ppSketchFetch("geo-entities/search?type=country&q=India", { cache: "no-store" });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ id: string; type: string; code: string; name: string }>;
    const row = rows.find((r) => r.type === "country");
    return row ? { id: row.id, type: "country", code: row.code, name: row.name, has_boundary: true, lat: null, lng: null } : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  return <DonorPage country={await india()} incompleteStates={readIncompleteStates()} />;
}
