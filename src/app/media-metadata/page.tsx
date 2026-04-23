import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CoveragePage } from "./coverage-page";

export default async function MediaMetadataPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-zinc-900">
            Media Metadata Coverage
          </h1>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-zinc-900 underline"
          >
            ← Dashboard
          </Link>
        </div>
        <p className="text-sm text-zinc-500 mb-4">
          Audio rows per (prefix, state-transition-suffix). Click a cell to see
          the media.
        </p>
        <CoveragePage />
      </div>
    </div>
  );
}