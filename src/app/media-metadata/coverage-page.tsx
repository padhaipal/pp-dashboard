"use client";

import { useCallback, useEffect, useState } from "react";
import { BulkCreateForm } from "./bulk-create-form";
import { CoverageTable } from "./coverage-table";
import { NonLessonTable } from "./non-lesson-table";
import { StidFamilyTable } from "./stid-family-table";
import { ComprehensionTable } from "./comprehension-table";
import { PassageSearch } from "./passage-search";
import { PassageStats } from "./passage-stats";
import {
  DAY_STREAK_STIDS,
  READING_SPEED_STIDS,
  type CoverageResponse,
} from "./types";

export function CoveragePage() {
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
    <>
      <PassageStats />
      <BulkCreateForm
        letters={data.letters}
        words={data.words}
        onCreated={() => load()}
      />
      <NonLessonTable />
      <StidFamilyTable
        title="Reading speed"
        hint="Generic `_` row serves every integer; specific rows override it."
        suffix="-wpm-reading-speed"
        stids={READING_SPEED_STIDS}
      />
      <StidFamilyTable
        title="Day streak"
        hint="Sent on the turn that takes the day to 5 active minutes, for streaks of 2–100 days. Generic `_` row serves every length; specific rows override it."
        suffix="-day-streak"
        stids={DAY_STREAK_STIDS}
      />
      <CoverageTable data={data} onReload={() => load()} />
      <PassageSearch />
      <ComprehensionTable />
    </>
  );
}