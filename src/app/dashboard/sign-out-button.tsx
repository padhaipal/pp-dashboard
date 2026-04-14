"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm text-zinc-500 underline hover:text-zinc-800"
    >
      Sign out
    </button>
  );
}
