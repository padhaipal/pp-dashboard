"use client";

import { useCallback, useEffect, useState } from "react";
import { BulkCreateForm } from "./bulk-create-form";
import { CoverageTable } from "./coverage-table";
import type { CoverageResponse } from "./types";

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
      <BulkCreateForm
        letters={data.letters}
        words={data.words}
        onCreated={() => load()}
      />
      <CoverageTable data={data} />
    </>
  );
}