import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function MediaMetadataPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-semibold text-zinc-900 mb-6">
          Media Metadata
        </h1>
        <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-8 text-center text-zinc-400">
          Coming soon
        </div>
      </div>
    </div>
  );
}
