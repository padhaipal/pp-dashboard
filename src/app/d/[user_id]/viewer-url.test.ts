import { describe, expect, it } from "vitest";
import { withViewer } from "./viewer-url";

describe("withViewer", () => {
  it("appends viewer= with ? or &, url-encoded; no viewer → unchanged", () => {
    expect(withViewer("/api/proxy/users/s-1/media", "u1")).toBe("/api/proxy/users/s-1/media?viewer=u1");
    expect(withViewer("/api/proxy/x?metric=usage", "u 1")).toBe("/api/proxy/x?metric=usage&viewer=u%201");
    expect(withViewer("/api/proxy/x", null)).toBe("/api/proxy/x");
    expect(withViewer("/api/proxy/x", undefined)).toBe("/api/proxy/x");
  });
});
