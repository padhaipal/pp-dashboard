import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  console.log("[auth] DashboardPage: checking session...");
  const session = await auth();
  console.log("[auth] DashboardPage: session=", JSON.stringify(session));
  if (!session) {
    console.log("[auth] DashboardPage: NO SESSION, redirecting to /login");
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          I&apos;m the dashboard
        </h1>
        <p className="text-sm text-zinc-600">
          Signed in as {session.user.external_id} ({session.user.role})
        </p>
        {session.user.role === "dev" && (
          <a
            href="/swagger"
            className="inline-block text-sm text-zinc-600 underline hover:text-zinc-900"
          >
            Swagger UI
          </a>
        )}
        <div>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
