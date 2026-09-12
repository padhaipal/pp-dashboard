import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// jsPDF must never be in the initial bundle: no static import anywhere under
// src/app/d, exactly one dynamic `import("jspdf")` (inside the export handler).
describe("jsPDF is loaded lazily", () => {
  it("has no static import and exactly one dynamic import", () => {
    const dir = path.join(process.cwd(), "src", "app", "d");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) files.push(p);
      }
    };
    walk(dir);
    expect(files.length).toBeGreaterThan(0);
    let dynamic = 0;
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/from\s+['"]jspdf['"]/);
      expect(src, f).not.toMatch(/require\(\s*['"]jspdf['"]\s*\)/);
      dynamic += (src.match(/import\(\s*['"]jspdf['"]\s*\)/g) ?? []).length;
    }
    expect(dynamic).toBe(1);
  });
});
