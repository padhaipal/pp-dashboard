"use client";

import { useState } from "react";
import { CoverageModal } from "./coverage-modal";
import type { CoverageResponse, MediaType } from "./types";

function MediaIcon({ type }: { type: MediaType }) {
  const common = {
    width: 11,
    height: 11,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-label": type,
  };
  switch (type) {
    case "audio":
      return (
        <svg {...common}>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      );
    case "text":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      );
    case "video":
      return (
        <svg {...common}>
          <polygon points="6 4 20 12 6 20 6 4" />
        </svg>
      );
    case "image":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case "sticker":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      );
  }
}

function toCsv(data: CoverageResponse): string {
  const escape = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const header: string[] = ["prefix"];
  for (const suffix of data.suffixes) {
    for (const mt of data.media_types) header.push(`${suffix} [${mt}]`);
  }
  const lines = [header.map(escape).join(",")];
  for (const row of data.rows) {
    const cells: string[] = [row.prefix];
    for (const counts of row.counts) {
      for (const mt of data.media_types) cells.push(String(counts[mt]));
    }
    lines.push(cells.map(escape).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(data: CoverageResponse) {
  const csv = toCsv(data);
  // UTF-8 BOM so Excel renders Devanagari correctly.
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

export function CoverageTable({ data }: { data: CoverageResponse }) {
  const [openStid, setOpenStid] = useState<string | null>(null);

  return (
    <>
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
                {row.counts.map((counts, i) => (
                  <td
                    key={i}
                    onClick={() =>
                      setOpenStid(`${row.prefix}-${data.suffixes[i]}`)
                    }
                    className="py-1.5 px-2 text-zinc-700 cursor-pointer hover:bg-emerald-50"
                    title={`${row.prefix}-${data.suffixes[i]}`}
                  >
                    <div className="flex gap-1.5 font-mono whitespace-nowrap justify-center items-center min-h-[14px]">
                      {data.media_types
                        .filter((mt) => counts[mt] > 0)
                        .map((mt) => (
                          <span
                            key={mt}
                            className="inline-flex items-center gap-0.5"
                          >
                            <MediaIcon type={mt} />
                            {counts[mt]}
                          </span>
                        ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openStid && (
        <CoverageModal stid={openStid} onClose={() => setOpenStid(null)} />
      )}
    </>
  );
}