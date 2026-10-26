"use client";

import { useState } from "react";
import {
  MANUAL_COLUMNS,
  MANUAL_MAX_ROWS,
  manualResultsCsv,
  manualTemplateCsv,
  parseManualPassagesCsv,
  toManualRun,
  type ManualRun,
  type ParsedRow,
} from "./manual-passages";

// Upload hand-written reading passages (CSV) → pp-sketch
// /media-meta-data/manual-passage, one row per request, one at a time —
// the same pacing as Seed Database (Sarvam rate limit on the gate calls).
// Every row goes through the same checks as LLM-generated passages; a
// failed check is final (no override) and the reason is shown per row.

type Loaded = { filename: string; rows: ParsedRow[] };

export function ManualUpload() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [runs, setRuns] = useState<ManualRun[]>([]);
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File | undefined) {
    setFileError(null);
    setLoaded(null);
    setRuns([]);
    if (!file) return;
    const parsed = parseManualPassagesCsv(await file.text(), file.name);
    if (!parsed.ok) {
      setFileError(parsed.error);
      return;
    }
    setLoaded({ filename: file.name, rows: parsed.rows });
    setRuns(
      parsed.rows.map((r): ManualRun =>
        r.body ? { status: "pending" } : { status: "skipped", reason: r.errors.join("; ") },
      ),
    );
  }

  function setRun(i: number, run: ManualRun) {
    setRuns((prev) => prev.map((r, idx) => (idx === i ? run : r)));
  }

  async function sendRow(i: number) {
    const body = loaded?.rows[i]?.body;
    if (!body) return;
    setRun(i, { status: "running" });
    try {
      const res = await fetch("/api/proxy/media-meta-data/manual-passage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      setRun(i, toManualRun(res.ok, res.status, json));
    } catch (err) {
      setRun(i, { status: "failed", reason: (err as Error).message, retriable: true });
    }
  }

  async function uploadAll() {
    if (!loaded) return;
    setUploading(true);
    for (let i = 0; i < loaded.rows.length; i++) {
      if (loaded.rows[i].body) await sendRow(i);
    }
    setUploading(false);
  }

  function downloadResults() {
    if (!loaded) return;
    downloadCsv(manualResultsCsv(loaded.rows, runs), loaded.filename.replace(/\.csv$/i, "") + "-results.csv");
  }

  const sendable = loaded?.rows.filter((r) => r.body).length ?? 0;
  const count = (s: ManualRun["status"]) => runs.filter((r) => r.status === s).length;
  const started = runs.some((r) => r.status !== "pending" && r.status !== "skipped");

  return (
    <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-4">
      <label className="block text-sm font-medium text-zinc-700 mb-1">Upload your own passages (CSV)</label>
      <p className="text-xs text-zinc-500 mb-2">
        One row = one passage with one question. Each row goes through exactly the same checks as a generated
        passage (passage quality → answer check → guessability check); a failed check can&apos;t be overridden, and
        the reason is shown below. The level is set from the word count. A passage that is already live, or
        repeated in the file, is rejected even with a different question. Rows are checked one at a time, ~1–2.5
        min each — keep this tab open until it finishes.
      </p>
      <details className="mb-3 rounded border border-zinc-200 p-2" open>
        <summary className="cursor-pointer text-xs font-medium text-zinc-700">Required CSV format</summary>
        <ul className="mt-2 mb-2 list-disc pl-5 text-xs text-zinc-600 space-y-0.5">
          <li>
            File: <strong>.csv</strong>, comma-separated, saved as <strong>UTF-8</strong> (Google Sheets: File →
            Download → .csv; Excel: Save As → &ldquo;CSV UTF-8&rdquo;).
          </li>
          <li>
            Row 1 is the header: the column names below, spelled exactly as shown. Column order doesn&apos;t matter.
            Any other columns are ignored.
          </li>
          <li>
            Each row after the header is <strong>one passage with exactly one question</strong> (2–4 options,
            exactly one correct, an explanation for every option). Up to {MANUAL_MAX_ROWS} rows per file.
          </li>
          <li>
            Don&apos;t add a level column: the level is set from the passage&apos;s word count (under 10 words → 8,
            under 40 → 9, under 70 → 10, under 110 → 11, under 250 → 12; 250+ is stored but never shown to students).
          </li>
          <li>Cells with commas or line breaks are fine as long as the spreadsheet app quotes them (it does by default).</li>
        </ul>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-200">
                <th className="py-1 pr-3 font-medium">Column</th>
                <th className="py-1 pr-3 font-medium">Required?</th>
                <th className="py-1 pr-3 font-medium">Rule</th>
                <th className="py-1 font-medium">Example</th>
              </tr>
            </thead>
            <tbody>
              {MANUAL_COLUMNS.map((c) => (
                <tr key={c.name} className="border-b border-zinc-100 align-top">
                  <td className="py-1 pr-3">
                    <code className="rounded bg-zinc-100 px-1">{c.name}</code>
                  </td>
                  <td className="py-1 pr-3 whitespace-nowrap">
                    {c.required ? <span className="text-zinc-900">required</span> : <span className="text-zinc-500">optional</span>}
                  </td>
                  <td className="py-1 pr-3 text-zinc-700">{c.rule}</td>
                  <td className="py-1 text-zinc-600">{c.example || <span className="text-zinc-400">(empty)</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={() => downloadCsv(manualTemplateCsv(), "passages-template.csv")}
          className="mt-2 text-xs text-blue-600 underline"
        >
          Download template CSV (header + one example row)
        </button>
      </details>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={uploading}
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-sm text-zinc-700"
        />
        <button
          onClick={uploadAll}
          disabled={uploading || sendable === 0 || started}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          {uploading
            ? `Checking… (${runs.filter((r) => r.status !== "pending" && r.status !== "running" && r.status !== "skipped").length}/${sendable})`
            : `Upload & check ${sendable} passage${sendable === 1 ? "" : "s"}`}
        </button>
        {started && !uploading && (
          <button onClick={downloadResults} className="text-sm text-blue-600 underline">
            Download results CSV
          </button>
        )}
      </div>
      {fileError && <p className="mt-2 text-xs text-red-600">{fileError}</p>}

      {loaded && (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-zinc-500">
            {count("created")} created · {count("rejected")} rejected · {count("failed")} failed ·{" "}
            {count("skipped")} not sent (fix the file) · {count("pending") + count("running")} to go
          </p>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {loaded.rows.map((r, i) => {
              const run = runs[i] ?? { status: "pending" };
              return (
                <div key={r.row} className="flex items-start gap-2 text-xs">
                  <span className="text-zinc-400 tabular-nums w-14 shrink-0">row {r.row}</span>
                  <span className="text-zinc-500 w-48 shrink-0 truncate" title={r.passagePreview}>
                    {r.passagePreview || "—"}
                  </span>
                  <span className="flex-1">
                    {run.status === "pending" && <span className="text-zinc-400">ready</span>}
                    {run.status === "running" && <span className="text-zinc-400">checking…</span>}
                    {run.status === "skipped" && <span className="text-red-600">not sent — {run.reason}</span>}
                    {run.status === "created" && (
                      <span className="text-emerald-700">
                        passed all checks — live at level {run.level}
                        {run.ttsError && <span className="text-amber-600"> — audio: {run.ttsError}</span>}
                      </span>
                    )}
                    {(run.status === "rejected" || run.status === "failed") && (
                      <span className={run.status === "failed" ? "text-red-600" : "text-amber-700"}>
                        {run.status}
                        {run.level !== undefined && ` (level ${run.level})`} — {run.reason}
                        {run.explanation && <span className="block text-zinc-600">{run.explanation}</span>}
                        {run.retriable && !uploading && (
                          <button onClick={() => sendRow(i)} className="ml-2 text-blue-600 underline">
                            retry
                          </button>
                        )}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
