import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";
import { UserTable } from "./user-table";
import { MetricsCharts } from "./metrics-charts";
import { DownloadInteractions } from "./download-interactions";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span>
              {session.user.external_id} ({session.user.role})
            </span>
            <Link
              href="/media-metadata"
              className="underline hover:text-zinc-900"
            >
              Media Metadata
            </Link>
            <Link href="/llm" className="underline hover:text-zinc-900">
              LLM
            </Link>
            <Link href="/onboarding" className="underline hover:text-zinc-900">
              Onboarding
            </Link>
            {session.user.role === "dev" && (
              <a
                href="/swagger"
                className="underline hover:text-zinc-900"
              >
                Swagger
              </a>
            )}
            <SignOutButton />
          </div>
        </div>
        <MetricsCharts />
        {/* Dev-only: the proxy forwards /users/interactions.csv for the dev
            role alone (not in the admin allowlist), so this gate and the
            proxy agree. */}
        {session.user.role === "dev" && <DownloadInteractions />}
        <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
          <UserTable />
        </div>
      </div>
    </div>
  );
}
