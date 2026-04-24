"use client";

import { useState } from "react";
import { CoverageModal } from "./coverage-modal";
import type { CoverageResponse, MediaType, MediaTypeCounts } from "./types";

const TYPE_ABBR: Record<MediaType, string> = {
  audio: "a",
  text: "t",
  video: "v",
  image: "i",
  sticker: "s",
};

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

function cellTotal(counts: MediaTypeCounts, mediaTypes: MediaType[]): number {
  let sum = 0;
  for (const mt of mediaTypes) sum += counts[mt];
  return sum;
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
                {row.counts.map((counts, i) => {
                  const total = cellTotal(counts, data.media_types);
                  return (
                    <td
                      key={i}
                      onClick={() =>
                        setOpenStid(`${row.prefix}-${data.suffixes[i]}`)
                      }
                      className={`py-1.5 px-2 cursor-pointer hover:bg-emerald-50 ${
                        total === 0 ? "text-zinc-300" : "text-zinc-700"
                      }`}
                      title={`${row.prefix}-${data.suffixes[i]}`}
                    >
                      <div className="flex gap-1.5 font-mono whitespace-nowrap justify-center">
                        {data.media_types.map((mt) => (
                          <span
                            key={mt}
                            className={
                              counts[mt] === 0 ? "text-zinc-300" : "text-zinc-700"
                            }
                          >
                            {TYPE_ABBR[mt]}
                            {counts[mt]}
                          </span>
                        ))}
                      </div>
                    </td>
                  );
                })}
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