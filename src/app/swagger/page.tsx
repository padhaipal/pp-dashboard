"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function SwaggerPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-10 bg-white border-b border-zinc-200 px-6 py-3 flex items-center">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5"
        >
          <span aria-hidden="true">&larr;</span> Dashboard
        </Link>
      </div>
      <SwaggerUI url="/api/swagger-spec" />
    </div>
  );
}
