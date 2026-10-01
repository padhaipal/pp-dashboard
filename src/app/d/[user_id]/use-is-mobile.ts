"use client";

import { useEffect, useState } from "react";

// True below the `sm` breakpoint (640 px). The charts switch to a narrower
// viewBox with larger type there. Shared by report-card-modal and
// mvp-widgets (which must not import each other in a cycle).
export function useIsMobile(bp = 640): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const q = window.matchMedia(`(max-width: ${bp - 0.02}px)`);
    const f = () => setM(q.matches);
    const t = setTimeout(f, 0);
    q.addEventListener("change", f);
    return () => {
      clearTimeout(t);
      q.removeEventListener("change", f);
    };
  }, [bp]);
  return m;
}
