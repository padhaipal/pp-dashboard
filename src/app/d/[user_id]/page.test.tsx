import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import PublicDashboardPage, { metadata } from "./page";
import { INACTIVE_LINK_TEXT } from "./dashboard-types";
import { jsonResponse } from "./test-fixtures";

describe("/d/[user_id] page", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
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
