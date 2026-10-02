"use client";

import { createContext, useContext, type ReactNode } from "react";

// The /d link holder's user id, for the widgets under TeacherDashboard that
// fetch on their own (the student modal, the audio button, the rename
// control, ScoreChart): `withViewer(url, useViewerId())` (viewer-url.ts).
// Outside the provider — the staff /user/[id] page — there is no viewer and
// URLs are left alone: the staff session identifies the caller instead.
const ViewerContext = createContext<string | null>(null);

export function ViewerProvider({ id, children }: { id: string; children: ReactNode }) {
  return <ViewerContext.Provider value={id}>{children}</ViewerContext.Provider>;
}

export const useViewerId = (): string | null => useContext(ViewerContext);

