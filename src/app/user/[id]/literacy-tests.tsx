"use client";

import { useEffect, useState } from "react";

// Digital-proxy literacy test scores from pp-sketch's
// GET /users/:id/literacy-test-scores. NIPUN grade 1 keeps its rolling-window
// shape; grades 2/3 and MPL-B are snapshot tests over first attempts, with a
// pass/fail per snapshot and a history of {at, score, passed}.

type RollingScore = {
  status: "ok" | "insufficient_data";
  window_size: number;
  attempts_available: number;
  latest_score?: number;
  history?: { at: string; score: number }[];
};

type SnapshotPoint = { at: string; score: number; passed: boolean };

type SnapshotScore = {
  status: "ok" | "insufficient_data";
  attempts_available: number;
  latest?: SnapshotPoint;
  history?: SnapshotPoint[];
};

type LiteracyTestScores = {
  nipun_grade_1: RollingScore;
  nipun_grade_2: SnapshotScore;
  nipun_grade_3: SnapshotScore;
  mpl_b: SnapshotScore;
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; data: LiteracyTestScores };

function pct(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function istDate(at: string): string {
  return new Date(at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
}

function PassBadge({ passed }: { passed: boolean }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
        passed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"
      }`}
    >
      {passed ? "pass" : "fail"}
    </span>
  );
}

function SnapshotCard({ title, sub, score }: { title: string; sub: string; score: SnapshotScore }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="text-xs text-zinc-500 mb-2">{sub}</p>
      {score.status === "insufficient_data" ? (
        <p className="text-xs text-zinc-400">
          insufficient data ({score.attempts_available} qualifying first attempts)
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-semibold tabular-nums text-zinc-900">
              {pct(score.latest!.score)}
            </span>
            <PassBadge passed={score.latest!.passed} />
            <span className="text-xs text-zinc-400">as of {istDate(score.latest!.at)}</span>
          </div>
          {score.history && score.history.length > 1 && (
            <div className="max-h-32 overflow-y-auto">
              <table className="w-full text-xs text-zinc-600">
                <tbody>
                  {[...score.history].reverse().map((h, i) => (
                    <tr key={i} className="border-t border-zinc-100">
                      <td className="py-0.5">{istDate(h.at)}</td>
                      <td className="py-0.5 tabular-nums">{pct(h.score)}</td>
                      <td className="py-0.5">
                        <PassBadge passed={h.passed} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function LiteracyTests({ userId }: { userId: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/proxy/users/${userId}/literacy-test-scores`);
        if (!res.ok) {
          if (!cancelled) setState({ status: "error", message: `HTTP ${res.status}` });
          return;
        }
        const data = (await res.json()) as LiteracyTestScores;
        if (!cancelled) setState({ status: "done", data });
      } catch (err) {
        if (!cancelled) setState({ status: "error", message: (err as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (state.status === "loading") {
    return <p className="text-xs text-zinc-400 mb-6">loading literacy tests…</p>;
  }
  if (state.status === "error") {
    return (
      <p className="text-xs text-red-600 mb-6">
        literacy tests failed to load: {state.message}
      </p>
    );
  }
  const d = state.data;
  const g1 = d.nipun_grade_1;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-zinc-900 mb-2">Literacy tests</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-900">NIPUN grade 1</h3>
          <p className="text-xs text-zinc-500 mb-2">
            rolling window of {g1.window_size} level-8 first read attempts
          </p>
          {g1.status === "insufficient_data" ? (
            <p className="text-xs text-zinc-400">
              insufficient data ({g1.attempts_available} attempts)
            </p>
          ) : (
            <span className="text-lg font-semibold tabular-nums text-zinc-900">
              {pct(g1.latest_score!)}
            </span>
          )}
        </div>
        <SnapshotCard
          title="NIPUN grade 2"
          sub="4 most recent level-10 R1.x first attempts · pass > 50%"
          score={d.nipun_grade_2}
        />
        <SnapshotCard
          title="NIPUN grade 3"
          sub="4 most recent level-11/12 R1.x first attempts · pass > 50%"
          score={d.nipun_grade_3}
        />
        <SnapshotCard
          title="MPL-B"
          sub="20 level-11/12 first attempts (type-balanced selection) · pass > 50%"
          score={d.mpl_b}
        />
      </div>
    </div>
  );
}
