import type { Metadata } from "next";
import { AVATAR_STYLE, seedFor } from "./avatar";
import { INACTIVE_LINK_TEXT, type PublicProfile } from "./dashboard-types";
import { readIncompleteStates } from "./incomplete-states";
import { renderAvatarSvg } from "./render-avatar";
import { TeacherDashboard } from "./teacher-dashboard";

// Public, unauthenticated dashboard for a Lifteracy user (teacher / official).
// No NextAuth: the link itself is the credential, so keep robots out.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PublicDashboardPage({ params }: { params: Promise<{ user_id: string }> }) {
  const { user_id } = await params;
  const base = process.env.PP_SKETCH_INTERNAL_URL ?? "";
  let res: Response;
  try {
    res = await fetch(`${base}/users/${encodeURIComponent(user_id)}/public`, { cache: "no-store" });
  } catch {
    return <Message text="The dashboard is temporarily unavailable. Please try again shortly." />;
  }
  if (res.status === 404) return <Message text={INACTIVE_LINK_TEXT} />;
  if (!res.ok) return <Message text="The dashboard is temporarily unavailable. Please try again shortly." />;

  const profile = (await res.json()) as PublicProfile;
  // States with a district lacking a boundary polygon → black, non-drillable on the map.
  const incompleteStates = readIncompleteStates();
  const seed = seedFor(profile.avatar_seed, profile.id);
  let avatarSvg: string | null = null;
  try {
    avatarSvg = renderAvatarSvg(AVATAR_STYLE, seed);
  } catch {
    avatarSvg = null;
  }

  return (
    <TeacherDashboard
      profile={profile}
      incompleteStates={incompleteStates}
      avatarSvg={avatarSvg}
    />
  );
}

function Message({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="max-w-md rounded-2xl border border-zinc-200 bg-white px-6 py-8 text-center shadow-sm">
        <div className="text-lg font-bold text-zinc-900">{text}</div>
        <div className="mt-2 text-sm text-zinc-500">Lifteracy</div>
      </div>
    </div>
  );
}
