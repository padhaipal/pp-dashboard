import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MediaTable } from "./media-table";

export default async function UserMediaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-zinc-900"
          >
            &larr; Back
          </Link>
          <h1 className="text-xl font-semibold text-zinc-900">User Media</h1>
          <span className="text-sm text-zinc-400 font-mono">{id}</span>
        </div>
        <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
          <MediaTable userId={id} />
        </div>
      </div>
    </div>
  );
}
