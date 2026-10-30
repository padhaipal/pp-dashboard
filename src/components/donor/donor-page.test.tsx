import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DonorPage } from "./donor-page";

vi.mock("next/font/google", () => ({ Caveat: () => ({ className: "caveat" }) }));

describe("DonorPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("header: Try it Out link and the Impact nav item; photos, partners and the report", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    render(<DonorPage country={null} incompleteStates={[]} />);
    await act(async () => {});
    const tryIt = screen.getByTestId("cta-try");
    expect(tryIt.textContent).toBe("Try it Out");
    expect(tryIt.getAttribute("href")).toBe("https://dashboard.padhaipal.com/r/919565897842");
    expect(screen.getByRole("link", { name: "Impact" }).getAttribute("href")).toBe("#measure");
    expect(screen.queryByRole("link", { name: "Measuring" })).toBeNull();
    expect(screen.getByTestId("photo-strip").querySelectorAll("img")).toHaveLength(8);
    const partners = screen.getAllByTestId("partner");
    expect(partners).toHaveLength(2);
    expect(partners[0].textContent).toContain("2026 incubatee of Charity Entrepreneurship");
    expect(partners[1].textContent).toContain("on-the-ground partner");
    expect(screen.getByTestId("report-link").getAttribute("href")).toBe("/donor/lifteracy-report.pdf");
    // partners sit just above What LIFTeracy Does
    expect(screen.getByTestId("partners").nextElementSibling?.id).toBe("what-does");
  });
});
