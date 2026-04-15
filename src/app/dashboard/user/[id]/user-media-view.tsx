"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { MediaTable } from "./media-table";
import { ScoreChart } from "./score-chart";

export function UserMediaView({ userId }: { userId: string }) {
  const [userName, setUserName] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);

  const onUserLoaded = useCallback(
    (user: { name: string | null; phone: string }) => {
      setUserName(user.name);
      setUserPhone(user.phone);
    },
    []
  );

  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard"
          className="px-3 py-1.5 text-sm font-medium bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded-md transition-colors"
        >
          &larr; Back
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">
            {userName ?? userId}
          </h1>
          {userPhone && (
            <p className="text-sm text-zinc-500 font-mono">{userPhone}</p>
          )}
        </div>
      </div>
      <ScoreChart userId={userId} />
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
        <MediaTable userId={userId} onUserLoaded={onUserLoaded} />
      </div>
    </>
  );
}
