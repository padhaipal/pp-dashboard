"use client";

import { useCallback, useEffect, useState } from "react";

interface CoverageRow {
  prefix: string;
  counts: number[];
  rolled_back_count: number;
}

interface CoverageResponse {
  suffixes: string[];
  rows: CoverageRow[];
}

function toCsv(data: CoverageResponse): string {
  const header = ["prefix", ...data.suffixes, "rolled_back_count"];
  const escape = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = [header.map(escape).join(",")];
  for (const row of data.rows) {
    const cells = [
      row.prefix,
      ...row.counts.map((n) => String(n)),
      String(row.rolled_back_count),
    ];
    lines.push(cells.map(escape).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(data: CoverageResponse) {
  const csv = toCsv(data);
  // Prepend UTF-8 BOM so Excel renders Devanagari correctly.
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "media-metadata-coverage.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function CoverageTable() {
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/media-meta-data/coverage");
      if (!res.ok) {
        setError(`Failed to load (${res.status})`);
        return;
      }
      setData(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return <div className="text-sm text-zinc-400 p-4">Loading...</div>;
  }
  if (error) {
    return <div className="text-sm text-red-600 p-4">{error}</div>;
  }
  if (!data) return null;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => downloadCsv(data)}
          className="px-3 py-1.5 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-md"
        >
          Download CSV
        </button>
      </div>
      <div className="overflow-auto border border-zinc-200 rounded-md bg-white max-h-[calc(100vh-180px)]">
        <table className="text-xs">
          <thead className="sticky top-0 bg-zinc-100 z-10">
            <tr>
              <th className="sticky left-0 bg-zinc-100 py-2 px-3 text-left font-medium text-zinc-700 border-r border-zinc-200 z-20">
                prefix
              </th>
              {data.suffixes.map((s) => (
                <th
                  key={s}
                  className="py-2 px-2 text-left font-medium text-zinc-700 whitespace-nowrap"
                >
                  {s}
                </th>
              ))}
              <th className="py-2 px-2 text-left font-medium text-red-600 whitespace-nowrap">
                rolled_back_count
              </th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr
                key={row.prefix}
                className="border-t border-zinc-100 hover:bg-zinc-50"
              >
                <td className="sticky left-0 bg-white hover:bg-zinc-50 py-1.5 px-3 font-mono border-r border-zinc-200">
                  {row.prefix}
                </td>
                {row.counts.map((n, i) => (
                  <td
                    key={i}
                    className={`py-1.5 px-2 text-right ${n === 0 ? "text-zinc-300" : "text-zinc-700"}`}
                  >
                    {n}
                  </td>
                ))}
                <td
                  className={`py-1.5 px-2 text-right ${row.rolled_back_count > 0 ? "text-red-600 font-semibold" : "text-zinc-300"}`}
                >
                  {row.rolled_back_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}