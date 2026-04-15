import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserMediaView } from "./user-media-view";

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
        <UserMediaView userId={id} />
      </div>
    </div>
  );
}
