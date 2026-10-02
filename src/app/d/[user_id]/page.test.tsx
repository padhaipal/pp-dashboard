import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PublicDashboardPage, { metadata } from "./page";
import { INACTIVE_LINK_TEXT } from "./dashboard-types";
import { jsonResponse } from "./test-fixtures";

describe("/d/[user_id] page", () => {
  beforeEach(() => {
    vi.stubEnv("PP_SKETCH_INTERNAL_URL", "http://pp.internal:3000");
    vi.stubEnv("PP_SKETCH_API_KEY", "dash-badge");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("asks pp-sketch for the public profile with the dashboard's badge", async () => {
    const fetch = vi.fn(async () => jsonResponse(404, {}));
    vi.stubGlobal("fetch", fetch);
    await PublicDashboardPage({ params: Promise.resolve({ user_id: "u1" }) });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://pp.internal:3000/users/u1/public");
    expect(new Headers(init.headers).get("x-api-key")).toBe("dash-badge");
  });

  it("shows the unavailable message (never a crash) when the badge is not configured", async () => {
    vi.stubEnv("PP_SKETCH_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn());
    render(await PublicDashboardPage({ params: Promise.resolve({ user_id: "u1" }) }));
    expect(screen.getByText(/temporarily unavailable/)).toBeDefined();
  });

  it("renders 'This link is not active' on 404", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(404, { message: "not found" })));
    const el = await PublicDashboardPage({ params: Promise.resolve({ user_id: "nope" }) });
    render(el);
    expect(screen.getByText(INACTIVE_LINK_TEXT)).toBeDefined();
  });

  it("is excluded from search engines", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
