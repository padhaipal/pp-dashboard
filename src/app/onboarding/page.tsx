import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "../dashboard/sign-out-button";
import { OnboardingConsole } from "./onboarding-console";

// Admin/dev only. Unauthenticated → /login; any other role → /dashboard.
// The proxy allowlist gates the underlying pp-sketch calls the same way.
export default async function OnboardingPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "admin" && session.user.role !== "dev") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-zinc-900">
            Staff onboarding
          </h1>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span>
              {session.user.external_id} ({session.user.role})
            </span>
            <Link href="/dashboard" className="underline hover:text-zinc-900">
              Dashboard
            </Link>
            <SignOutButton />
          </div>
        </div>
        <OnboardingConsole />
      </div>
    </div>
  );
}
