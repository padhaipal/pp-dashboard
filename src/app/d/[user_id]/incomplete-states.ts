// Server-only: states with at least one district lacking a boundary polygon.
// Source of truth: public/boundaries/districts_without_boundary.csv
// (columns state_code,district_code,udise_name,reason). Read with fs in the
// server page and passed down as a prop — no build script.

import fs from "node:fs";
import path from "node:path";

export const INCOMPLETE_CSV = path.join("public", "boundaries", "districts_without_boundary.csv");

export function parseIncompleteStates(csv: string): string[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const header = lines.shift()?.split(",").map((h) => h.trim()) ?? [];
  const idx = header.indexOf("state_code");
  if (idx < 0) return [];
  const set = new Set<string>();
  for (const line of lines) {
    const cell = line.split(",")[idx]?.trim();
    if (cell) set.add(cell.padStart(2, "0"));
  }
  return [...set].sort();
}

export function readIncompleteStates(): string[] {
  try {
    return parseIncompleteStates(fs.readFileSync(path.join(process.cwd(), INCOMPLETE_CSV), "utf8"));
  } catch {
    return [];
  }
}
