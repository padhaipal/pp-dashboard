"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      phone: formData.get("phone") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    setLoading(false);

    console.log("[auth] signIn result:", JSON.stringify(res));
    if (res?.error) {
      setError(`Login failed: ${res.error} (status ${res.status} url=${res.url})`);
    } else {
      console.log("[auth] signIn OK, navigating to /dashboard. res.ok=", res?.ok, "res.url=", res?.url);
      window.location.href = "/dashboard";
      console.log("[auth] navigation triggered");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow"
      >
        <h1 className="text-xl font-semibold text-zinc-900">PadhaiPal Dashboard</h1>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-zinc-700">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="text"
            required
            autoComplete="tel"
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
