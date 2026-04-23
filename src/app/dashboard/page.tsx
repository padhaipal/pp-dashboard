import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";
import { UserTable } from "./user-table";

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
        <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
          <UserTable />
        </div>
      </div>
    </div>
  );
}
