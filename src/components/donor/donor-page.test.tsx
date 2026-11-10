import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DonorPage } from "./donor-page";

vi.mock("next/font/google", () => ({ Caveat: () => ({ className: "caveat" }) }));

describe("DonorPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("the map stays English even when a /d dashboard saved Hindi on this site", async () => {
    window.localStorage.setItem("lifteracy-dashboard-lang", "hi");
    try {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
      const geo = { id: "g-in", type: "country" as const, code: "IN", name: "India", has_boundary: true, lat: null, lng: null };
      render(<DonorPage country={geo} incompleteStates={[]} />);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });
      expect(screen.getAllByRole("button", { name: "Usage time" }).length).toBeGreaterThan(0);
    } finally {
      window.localStorage.removeItem("lifteracy-dashboard-lang");
    }
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
    // phones and narrow windows show half: the second column of each pair is hidden below lg
    const always = screen.getAllByTestId("photo-column");
    const wideOnly = screen.getAllByTestId("photo-column-wide");
    expect(always.flatMap((c) => [...c.querySelectorAll("img")])).toHaveLength(4);
    expect(wideOnly.flatMap((c) => [...c.querySelectorAll("img")])).toHaveLength(4);
    for (const c of wideOnly) expect(c.className).toContain("hidden lg:flex");
    for (const c of always) expect(c.className).not.toContain("hidden");
    const partners = screen.getAllByTestId("partner");
    expect(partners).toHaveLength(2);
    expect(partners[0].textContent).toBe("LIFTeracy is a 2026 incubatee of Ambitious Impact’s Charity Entrepreneurship Program.");
    expect(partners[1].textContent).toContain("DEVI Sansthan is our on-the-ground partner");
    expect(screen.getByTestId("report-link").getAttribute("href")).toBe("/donor/lifteracy-report.pdf");
    expect(document.querySelector("video")?.getAttribute("src")).toBe("/donor/lifteracy-demo.mp4");
    // advisors: the report's four, under the founders in the Team section
    const advisors = screen.getAllByTestId("advisor");
    expect(advisors.map((a) => a.querySelector("a")?.textContent)).toEqual(["Ilana Kessler", "Abdulhamid Haidar", "Natasha Ahuja", "Sofia Martinez Galvez"]);
    expect(advisors[1].textContent).toContain("EdTech");
    expect(advisors[1].querySelector("a")?.getAttribute("href")).toBe("https://www.linkedin.com/in/abdulhamid-haidar/");
    expect(screen.getByTestId("advisors").closest("section")?.id).toBe("team");
    // partners sit just above What LIFTeracy Does
    expect(screen.getByTestId("partners").nextElementSibling?.id).toBe("what-does");
  });
});
